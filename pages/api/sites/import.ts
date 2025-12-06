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
    // New logic: Check for categoryName and create new categories if needed.

    let addedCount = 0;

    const existingCategories = await storage.getCategories();
    // Create a map of existing categories for quick lookup
    const categoryMap = new Map(existingCategories.map(c => [c.name.toLowerCase(), c.id]));
    const validCategoryIds = new Set(existingCategories.map(c => c.id));

    try {
        for (const site of sites) {
            if (!site.title || !site.url) continue;

            let finalCategoryId = site.categoryId;
            const importedCategoryName = (site as any).categoryName;

            // Priority 1: If categoryName is provided
            if (importedCategoryName) {
                const lowerName = importedCategoryName.toLowerCase();
                if (categoryMap.has(lowerName)) {
                    // Use existing category ID
                    finalCategoryId = categoryMap.get(lowerName);
                } else {
                    // Create new category
                    const newId = randomUUID();
                    const newCategory = { id: newId, name: importedCategoryName };
                    await storage.addCategory(newCategory);

                    // Update our local lookups
                    categoryMap.set(lowerName, newId);
                    validCategoryIds.add(newId);

                    finalCategoryId = newId;
                }
            }
            // Priority 2: Fallback to existing logic (check if ID is valid)
            else if (site.categoryId && validCategoryIds.has(site.categoryId)) {
                finalCategoryId = site.categoryId;
            } else {
                finalCategoryId = undefined;
            }

            const newSite: Website = {
                id: randomUUID(),
                title: site.title,
                url: site.url,
                description: site.description || '',
                iconUrl: site.iconUrl || '',
                status: 'unknown',
                lastChecked: 0,
                categoryId: finalCategoryId
            };

            await storage.addWebsite(newSite);
            addedCount++;
        }

        return res.status(200).json({ message: 'Import successful', count: addedCount });
    } catch (error) {
        console.error('Import error', error);
        return res.status(500).json({ error: 'Failed to import websites' });
    }
}
