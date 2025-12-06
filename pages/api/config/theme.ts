import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../../utils/storage';
import { verifyJwt } from '../../../utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return res.status(200).json({ theme: await storage.getTheme() });
    }

    if (req.method === 'POST') {
        // Protected endpoint - only admin can change global theme
        const { auth_token } = req.cookies;
        if (!auth_token || !verifyJwt(auth_token)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { theme } = req.body;
        if (!theme) {
            return res.status(400).json({ error: 'Missing theme' });
        }

        await storage.setTheme(theme);

        return res.status(200).json({ theme });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
