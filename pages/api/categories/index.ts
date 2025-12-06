import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../../utils/storage';
import { verifyJwt } from '../../../utils/auth';
import { Category } from '../../../types';
import { randomUUID } from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        const categories = await storage.getCategories();
        return res.status(200).json(categories);
    }

    if (req.method === 'POST') {
        const { auth_token } = req.cookies;
        if (!auth_token || !verifyJwt(auth_token)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Missing name' });
        }

        const newCategory: Category = {
            id: randomUUID(),
            name: name
        };

        await storage.addCategory(newCategory);
        return res.status(201).json(newCategory);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
