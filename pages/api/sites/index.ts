import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '../../../utils/db';
import { verifyJwt } from '../../../utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const db = await getDb();

    if (req.method === 'GET') {
        const sites = await db.all('SELECT * FROM websites');
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

        const id = crypto.randomUUID();
        const status = 'unknown';
        const lastChecked = 0;

        await db.run(
            'INSERT INTO websites (id, title, url, description, iconUrl, status, lastChecked) VALUES (?, ?, ?, ?, ?, ?, ?)',
            id, title, url, description, iconUrl, status, lastChecked
        );

        return res.status(201).json({ id, title, url, description, iconUrl, status, lastChecked });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
