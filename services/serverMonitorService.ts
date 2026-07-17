import { Website } from '../types';
import { storage } from '../utils/storage';
import {
  probePublicWebsite,
  ProbeResult,
  ServerProbeFailureReason,
  UnsafeUrlError,
} from '../utils/safeHttpRequest';

export type PersistedMonitorReason = ServerProbeFailureReason | 'unsafe-url';
export type MonitorFailureReason = PersistedMonitorReason | 'database-error';

export interface PersistedMonitorResult extends Omit<ProbeResult, 'reason'> {
  lastChecked: number;
  reason?: PersistedMonitorReason;
}

export class MonitorPersistenceError extends Error {
  constructor(public readonly siteId: string) {
    super('Failed to persist website status');
    this.name = 'MonitorPersistenceError';
  }
}

export async function checkAndPersistWebsite(site: Website): Promise<PersistedMonitorResult> {
  const startedAt = Date.now();
  let result: Omit<PersistedMonitorResult, 'lastChecked'>;

  try {
    result = await probePublicWebsite(site.url);
  } catch (error) {
    if (!(error instanceof UnsafeUrlError)) throw error;
    result = {
      status: 'offline',
      statusCode: 0,
      latency: Date.now() - startedAt,
      reason: 'unsafe-url',
    };
  }

  const lastChecked = Date.now();
  const persisted = await storage.updateWebsiteMonitor(site.id, {
    status: result.status,
    lastChecked,
    latency: result.latency,
    serverStatusCode: result.statusCode || undefined,
    serverReason: result.reason,
  });
  if (!persisted) throw new MonitorPersistenceError(site.id);

  return { ...result, lastChecked };
}
