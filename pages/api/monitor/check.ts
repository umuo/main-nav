import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../../utils/storage';
import { probePublicWebsite, UnsafeUrlError } from '../../../utils/safeHttpRequest';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.body;
  if (typeof id !== 'string' || !id) {
    return res.status(400).json({ error: 'Missing site ID' });
  }

  try {
    const site = await storage.getWebsite(id);
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const result = await probePublicWebsite(site.url);
    const lastChecked = Date.now();
    const persisted = await storage.updateWebsite(id, {
      status: result.status,
      lastChecked,
      latency: result.latency,
    });
    if (!persisted) throw new Error('Failed to persist website status');

    return res.status(200).json({ ...result, lastChecked });
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      await storage.updateWebsite(id, {
        status: 'offline',
        lastChecked: Date.now(),
        latency: 0,
      });
      return res.status(422).json({ error: 'The configured URL is not a safe public HTTP target' });
    }
    console.error('Website check failed:', error instanceof Error ? error.message : 'Unknown error');
    return res.status(500).json({ error: 'Failed to check website' });
  }
}
