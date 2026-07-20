import type { NextApiRequest, NextApiResponse } from 'next';
import {
  checkAndPersistWebsite,
  MonitorFailureReason,
  MonitorPersistenceError,
} from '../../../services/serverMonitorService';
import { ConfigurationError } from '../../../utils/env';
import { hasAdminAccess, hasValidCronSecret } from '../../../utils/monitorAuthorization';
import { storage } from '../../../utils/storage';
import { Website } from '../../../types';

const MONITOR_CONCURRENCY = 4;

interface BatchItemResult {
  id: string;
  status: 'online' | 'offline';
  statusCode?: number;
  latency?: number;
  lastChecked?: number;
  reason?: MonitorFailureReason | 'internal-error';
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}

async function checkSite(site: Website): Promise<BatchItemResult> {
  try {
    return { id: site.id, ...(await checkAndPersistWebsite(site)) };
  } catch (error) {
    if (error instanceof MonitorPersistenceError) {
      console.error('Batch monitor persistence failed', { siteId: site.id });
      return { id: site.id, status: 'offline', reason: 'database-error' };
    }

    const metadata = error && typeof error === 'object'
      ? {
          name: 'name' in error ? String(error.name) : 'MonitorError',
          ...('code' in error ? { code: String(error.code) } : {}),
        }
      : { name: 'UnknownError' };
    console.error('Batch monitor check failed', { siteId: site.id, ...metadata });
    return { id: site.id, status: 'offline', reason: 'internal-error' };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method || '')) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const cronAuthorized = hasValidCronSecret(req);
    const authorized = req.method === 'GET'
      ? cronAuthorized
      : cronAuthorized || hasAdminAccess(req);
    if (!authorized) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sites = await storage.getWebsites();
    const startedAt = Date.now();
    const results = await mapWithConcurrency(sites, MONITOR_CONCURRENCY, checkSite);
    const online = results.filter(result => result.status === 'online').length;
    const failed = results.filter(result => result.reason === 'database-error' || result.reason === 'internal-error').length;

    console.info('Batch monitor completed', {
      checked: results.length,
      online,
      offline: results.length - online,
      failed,
      durationMs: Date.now() - startedAt,
    });

    return res.status(200).json({
      success: failed === 0,
      checked: results.length,
      online,
      offline: results.length - online,
      failed,
      durationMs: Date.now() - startedAt,
      results,
    });
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error('Batch monitor authentication configuration error', { name: error.name });
      return res.status(500).json({ error: 'Monitoring authentication is not configured' });
    }

    const metadata = error && typeof error === 'object'
      ? {
          name: 'name' in error ? String(error.name) : 'MonitorError',
          ...('code' in error ? { code: String(error.code) } : {}),
        }
      : { name: 'UnknownError' };
    console.error('Batch monitor failed', metadata);
    return res.status(500).json({ error: 'Failed to run website checks' });
  }
}
