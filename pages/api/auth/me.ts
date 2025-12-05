import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyJwt } from '../../../utils/auth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { auth_token } = req.cookies;

    if (!auth_token) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const payload = verifyJwt(auth_token);

    if (!payload) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    res.status(200).json({ user: payload });
}
