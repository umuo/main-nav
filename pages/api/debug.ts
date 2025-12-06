import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../utils/storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    res.status(200).json({
        pid: process.pid,
        uptime: process.uptime(),
        websiteCount: (await storage.getWebsites()).length,
        categoryCount: (await storage.getCategories()).length,
        websites: await storage.getWebsites()
    });
}
