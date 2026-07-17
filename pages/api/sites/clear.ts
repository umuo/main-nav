import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../../utils/storage';
import { verifyJwt } from '../../../utils/auth';

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

    try {
        const success = await storage.clearAllData();
        if (success) {
            return res.status(200).json({ message: 'Data cleared successfully' });
        } else {
            return res.status(500).json({ error: 'Failed to clear data' });
        }
    } catch (error) {
        console.error('Clear data error', error);
        return res.status(500).json({ error: 'Failed to clear data' });
    }
}
