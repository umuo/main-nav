import type { NextApiRequest, NextApiResponse } from 'next';
import { checkAndPersistWebsite, MonitorPersistenceError } from '../../../services/serverMonitorService';
import { ConfigurationError } from '../../../utils/env';
import { hasAdminSession } from '../../../utils/monitorAuthorization';
import { storage } from '../../../utils/storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!hasAdminSession(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.body;
    if (typeof id !== 'string' || !id) {
      return res.status(400).json({ error: 'Missing site ID' });
    }

    const site = await storage.getWebsite(id);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const result = await checkAndPersistWebsite(site);
    if (result.reason === 'unsafe-url') {
      return res.status(422).json({
        ...result,
        error: 'The configured URL is not a safe public HTTP target',
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof MonitorPersistenceError) {
      console.error('Monitor persistence failed', { siteId: error.siteId });
      return res.status(503).json({ error: 'Database write failed', reason: 'database-error' });
    }
    if (error instanceof ConfigurationError) {
      console.error('Monitor authentication configuration error', { name: error.name });
      return res.status(500).json({ error: 'Monitoring authentication is not configured' });
    }

    const metadata = error && typeof error === 'object'
      ? {
          name: 'name' in error ? String(error.name) : 'MonitorError',
          ...('code' in error ? { code: String(error.code) } : {}),
        }
      : { name: 'UnknownError' };
    console.error('Website check failed', metadata);
    return res.status(500).json({ error: 'Failed to check website' });
  }
}
