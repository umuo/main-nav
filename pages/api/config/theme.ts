import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../../utils/storage';
import { hasAdminAccess } from '../../../utils/monitorAuthorization';
import { Theme } from '../../../types';

const THEMES: Theme[] = ['vibe', 'sunset', 'ocean', 'minimal'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        try {
            return res.status(200).json({ theme: await storage.getTheme() });
        } catch {
            console.error('Database unavailable while loading the theme.');
            return res.status(503).json({ error: 'Database unavailable' });
        }
    }

    if (req.method === 'POST') {
        // Protected endpoint - only admin can change global theme
        if (!hasAdminAccess(req)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { theme } = req.body;
        if (typeof theme !== 'string' || !THEMES.includes(theme as Theme)) {
            return res.status(400).json({ error: 'Invalid theme' });
        }

        await storage.setTheme(theme as Theme);

        return res.status(200).json({ theme });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
