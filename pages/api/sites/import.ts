```typescript
import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../../utils/storage';
import { verifyJwt } from '../../../utils/auth';
import { Website } from '../../../types';
import { randomUUID } from 'crypto';

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

    const sites = req.body as Website[];
    
    if (!Array.isArray(sites)) {
        return res.status(400).json({ error: 'Invalid format. Expected an array of websites.' });
    }

    // We will attempt to insert valid sites. 
    // Strategy: Insert new ones. 
    // Optionally we could update existing ones if IDs match, but for simplicity/safety:
    // We will generate NEW IDs for imported items to avoid collision, unless they are "system" restores.
    // Actually, usually import implies "add these". 
    // Let's generate new IDs to be safe against duplicates unless the user specifically clears DB first.

    let addedCount = 0;
    
    try {
        for (const site of sites) {
            if (!site.title || !site.url) continue;

            const newSite: Website = {
                id: randomUUID(),
                title: site.title,
                url: site.url,
                description: site.description || '',
                iconUrl: site.iconUrl || '',
                status: 'unknown',
                lastChecked: 0
            };
            
            storage.addWebsite(newSite);
            addedCount++;
        }
        
        return res.status(200).json({ message: 'Import successful', count: addedCount });
    } catch (error) {
        console.error('Import error', error);
        return res.status(500).json({ error: 'Failed to import websites' });
    }
}
```
