import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../utils/storage';
import { hasAdminAccess } from '../../utils/monitorAuthorization';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!hasAdminAccess(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const [websites, categories] = await Promise.all([
        storage.getWebsites(),
        storage.getCategories(),
    ]);

    res.status(200).json({
        websiteCount: websites.length,
        categoryCount: categories.length,
    });
}
