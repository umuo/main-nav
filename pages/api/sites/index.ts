import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../../utils/storage';
import { verifyJwt } from '../../../utils/auth';
import { randomUUID } from 'crypto';
import { Website } from '../../../types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        const sites = storage.getWebsites();
        return res.status(200).json(sites);
    }

    if (req.method === 'POST') {
        // Protected endpoint
        const { auth_token } = req.cookies;
        if (!auth_token || !verifyJwt(auth_token)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { title, url, description, iconUrl } = req.body;
        if (!title || !url) {
            return res.status(400).json({ error: 'Missing title or url' });
        }

        const newSite: Website = {
            id: randomUUID(),
            title,
            url,
            description: description || '',
            iconUrl: iconUrl || '',
            status: 'unknown',
            lastChecked: 0
        };

        storage.addWebsite(newSite);

        return res.status(201).json(newSite);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
