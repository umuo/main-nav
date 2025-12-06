import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '../../../utils/db';
import { verifyJwt } from '../../../utils/auth';
import { Website } from '../../../types';
import { randomUUID } from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { auth_token } = req.cookies;
    if (!auth_token || !verifyJwt(auth_token)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const sites = req.body as Website[];

    if (!Array.isArray(sites)) {
        return res.status(400).json({ error: 'Invalid format. Expected an array of websites.' });
    }

    const db = await getDb();

    // We will attempt to insert valid sites. 
    // Strategy: Insert new ones. 
    // Optionally we could update existing ones if IDs match, but for simplicity/safety:
    // We will generate NEW IDs for imported items to avoid collision, unless they are "system" restores.
    // Actually, usually import implies "add these". 
    // Let's generate new IDs to be safe against duplicates unless the user specifically clears DB first.

    let addedCount = 0;

    try {
        await db.run('BEGIN TRANSACTION');

        const stmt = await db.prepare('INSERT INTO websites (id, title, url, description, iconUrl, status, lastChecked) VALUES (?, ?, ?, ?, ?, ?, ?)');

        for (const site of sites) {
            if (!site.title || !site.url) continue;

            const id = randomUUID();
            const status = 'unknown';
            const lastChecked = 0;

            await stmt.run(
                id,
                site.title,
                site.url,
                site.description || '',
                site.iconUrl || '',
                status,
                lastChecked
            );
            addedCount++;
        }

        await stmt.finalize();
        await db.run('COMMIT');

        return res.status(200).json({ message: 'Import successful', count: addedCount });
    } catch (error) {
        await db.run('ROLLBACK');
        console.error('Import error', error);
        return res.status(500).json({ error: 'Failed to import websites' });
    }
}
