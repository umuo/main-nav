import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '../../../utils/db';
import { verifyJwt } from '../../../utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const db = await getDb();

    if (req.method === 'GET') {
        const row = await db.get('SELECT value FROM config WHERE key = ?', 'theme');
        return res.status(200).json({ theme: row ? row.value : 'minimal' });
    }

    if (req.method === 'POST') {
        // Protected endpoint - only admin can change global theme
        const { auth_token } = req.cookies;
        if (!auth_token || !verifyJwt(auth_token)) {
            // Note: In a real app we might allow user-specific local overrides, 
            // but the request is specific: "Admin changes it -> applies to everyone".
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { theme } = req.body;
        if (!theme) {
            return res.status(400).json({ error: 'Missing theme' });
        }

        await db.run(
            'INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
            'theme', theme
        );

        return res.status(200).json({ theme });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
