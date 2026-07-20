import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../../utils/storage';
import { hasAdminAccess } from '../../../utils/monitorAuthorization';
import { Category } from '../../../types';
import { randomUUID } from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        try {
            const categories = await storage.getCategories();
            return res.status(200).json(categories);
        } catch {
            console.error('Database unavailable while loading categories.');
            return res.status(503).json({ error: 'Database unavailable' });
        }
    }

    if (req.method === 'POST') {
        if (!hasAdminAccess(req)) {
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
