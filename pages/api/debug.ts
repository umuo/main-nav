import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../utils/storage';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    const db = global.mockDb;

    res.status(200).json({
        pid: process.pid,
        uptime: process.uptime(),
        websiteCount: storage.getWebsites().length,
        categoryCount: storage.getCategories().length,
        rawDbWebsites: db?.websites?.length,
        globalDefined: !!db,
        websites: storage.getWebsites()
    });
}
