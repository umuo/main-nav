import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '../../../utils/db';
import { verifyJwt } from '../../../utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const db = await getDb();
    const { id } = req.query;

    // Most operations here should be protected
    // Allowing GET specific site public? Dashboard is public.
    // DELETE / UPDATE -> Protected.

    if (req.method === 'DELETE') {
        const { auth_token } = req.cookies;
        if (!auth_token || !verifyJwt(auth_token)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        await db.run('DELETE FROM websites WHERE id = ?', id);
        return res.status(200).json({ success: true });
    }

    if (req.method === 'PUT') {
        // This might be used by the monitor service (publicly callable? or internal?)
        // For now, let's treat it as an admin update OR a status update.
        // If it's a status update, usually it comes from the monitor checking.
        // If it's an edit (name/url), it needs auth.
        // Let's assume generic update for now, but require auth for simplicity unless we separate status updates.
        // Wait, the dashboard updates status. The dashboard is public (status check).
        // The "monitor" logic currently runs on the CLIENT (in index.tsx). 
        // The client calls /api/monitor/check, gets a result, then updates LOCAL state.
        // It doesn't persist the 'online/offline' status to DB?
        // If we want persistence, the status check should probably update the DB.

        // For now, let's allow updating name/url with AUTH, and status perhaps without?
        // User said "storing added websites". 
        // Let's protect generic PUT.

        const { auth_token } = req.cookies;
        if (!auth_token || !verifyJwt(auth_token)) {
            // If allow status update public? Risky.
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { title, url, status, lastChecked, description, iconUrl } = req.body;

        // Construct dynamic update
        // This is a bit lazy, but works for now.

        if (title) await db.run('UPDATE websites SET title = ? WHERE id = ?', title, id);
        if (url) await db.run('UPDATE websites SET url = ? WHERE id = ?', url, id);
        if (description) await db.run('UPDATE websites SET description = ? WHERE id = ?', description, id);
        if (iconUrl) await db.run('UPDATE websites SET iconUrl = ? WHERE id = ?', iconUrl, id);
        if (status) await db.run('UPDATE websites SET status = ? WHERE id = ?', status, id);
        if (lastChecked) await db.run('UPDATE websites SET lastChecked = ? WHERE id = ?', lastChecked, id);

        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
