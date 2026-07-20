import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../../utils/storage';
import { hasAdminAccess } from '../../../utils/monitorAuthorization';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id } = req.query;
    const categoryId = Array.isArray(id) ? id[0] : id;

    if (!categoryId) return res.status(400).json({ error: 'Missing ID' });

    if (req.method === 'PUT') {
        if (!hasAdminAccess(req)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Missing name' });
        }

        const success = await storage.updateCategory(categoryId, name);
        if (!success) {
            return res.status(404).json({ error: 'Category not found' });
        }
        return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
        if (!hasAdminAccess(req)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const success = await storage.deleteCategory(categoryId);
        if (!success) {
            return res.status(400).json({ error: 'Cannot delete default/last category or category not found' });
        }
        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
