import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../../utils/storage';
import { verifyJwt } from '../../../utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id } = req.query;
    const siteId = Array.isArray(id) ? id[0] : id;

    if (!siteId) return res.status(400).json({ error: 'Missing ID' });

    if (req.method === 'DELETE') {
        const { auth_token } = req.cookies;
        if (!auth_token || !verifyJwt(auth_token)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const success = await storage.deleteWebsite(siteId);
        if (success) {
            return res.status(200).json({ success: true });
        } else {
            // Technically if it doesn't exist we could say 404, but idempotent delete is fine too.
            // But storage returns false if length didn't change (not found).
            return res.status(404).json({ error: 'Site not found' });
        }
    }

    if (req.method === 'PUT') {
        const { auth_token } = req.cookies;
        if (!auth_token || !verifyJwt(auth_token)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const updates = req.body;
        const success = await storage.updateWebsite(siteId, updates);

        if (success) {
            return res.status(200).json({ success: true });
        } else {
            return res.status(404).json({ error: 'Site not found' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
