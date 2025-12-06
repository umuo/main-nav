import { Website, Theme, Category } from '../types';
import { kv } from '@vercel/kv';
import fs from 'fs/promises';
import path from 'path';

// Storage Interface
interface DataStore {
    getWebsites(): Promise<Website[]>;
    addWebsite(site: Website): Promise<Website>;
    updateWebsite(id: string, updates: Partial<Website>): Promise<boolean>;
    deleteWebsite(id: string): Promise<boolean>;

    getCategories(): Promise<Category[]>;
    addCategory(category: Category): Promise<Category>;
    updateCategory(id: string, name: string): Promise<boolean>;
    deleteCategory(id: string): Promise<boolean>;

    getTheme(): Promise<Theme>;
    setTheme(theme: Theme): Promise<void>;
}

// --- Vercel KV Implementation ---
class VercelKVStore implements DataStore {
    async getWebsites(): Promise<Website[]> {
        const sites = await kv.hgetall<Record<string, Website>>('websites');
        return sites ? Object.values(sites) : [];
    }

    async addWebsite(site: Website): Promise<Website> {
        // Default category logic should be handled by business logic, but we can check here too if needed.
        // For simplicity, we assume the caller handles defaults, or we do a quick check.
        if (!site.categoryId) {
            const categories = await this.getCategories();
            if (categories.length > 0) site.categoryId = categories[0].id;
        }
        await kv.hset('websites', { [site.id]: site });
        return site;
    }

    async updateWebsite(id: string, updates: Partial<Website>): Promise<boolean> {
        const site = await kv.hget<Website>('websites', id);
        if (site) {
            const updatedSite = { ...site, ...updates };
            await kv.hset('websites', { [id]: updatedSite });
            return true;
        }
        return false;
    }

    async deleteWebsite(id: string): Promise<boolean> {
        const result = await kv.hdel('websites', id);
        return result > 0;
    }

    async getCategories(): Promise<Category[]> {
        const categories = await kv.hgetall<Record<string, Category>>('categories');
        // If empty, return default
        if (!categories || Object.keys(categories).length === 0) {
            return [{ id: 'default', name: 'General' }];
        }
        return Object.values(categories);
    }

    async addCategory(category: Category): Promise<Category> {
        await kv.hset('categories', { [category.id]: category });
        return category;
    }

    async updateCategory(id: string, name: string): Promise<boolean> {
        const category = await kv.hget<Category>('categories', id);
        if (category) {
            category.name = name;
            await kv.hset('categories', { [id]: category });
            return true;
        }
        return false;
    }

    async deleteCategory(id: string): Promise<boolean> {
        // Check count
        const categories = await this.getCategories();
        if (categories.length <= 1) return false;

        await kv.hdel('categories', id);

        // Re-assign sites
        // This is expensive in KV (fetch all, filter, update).
        // For now, let's just do it.
        const sites = await this.getWebsites();
        const fallbackId = categories.find(c => c.id !== id)?.id || 'default';

        for (const site of sites) {
            if (site.categoryId === id) {
                site.categoryId = fallbackId;
                await kv.hset('websites', { [site.id]: site });
            }
        }
        return true;
    }

    async getTheme(): Promise<Theme> {
        return (await kv.get<Theme>('config:theme')) || 'minimal';
    }

    async setTheme(theme: Theme): Promise<void> {
        await kv.set('config:theme', theme);
    }
}

// --- Local File Implementation ---
class FileStore implements DataStore {
    private filePath = path.join(process.cwd(), 'data', 'db.json');
    private memoryCache: any = null;

    private async ensureData() {
        if (this.memoryCache) return this.memoryCache;

        try {
            const data = await fs.readFile(this.filePath, 'utf-8');
            this.memoryCache = JSON.parse(data);
        } catch (error) {
            // File doesn't exist or is invalid, init defaults
            this.memoryCache = {
                websites: [],
                categories: [{ id: 'default', name: 'General' }],
                config: { theme: 'minimal' }
            };
            await this.saveData();
        }
        return this.memoryCache;
    }

    private async saveData() {
        const dir = path.dirname(this.filePath);
        try {
            await fs.access(dir);
        } catch {
            await fs.mkdir(dir, { recursive: true });
        }
        await fs.writeFile(this.filePath, JSON.stringify(this.memoryCache, null, 2));
    }

    async getWebsites(): Promise<Website[]> {
        const db = await this.ensureData();
        return db.websites;
    }

    async addWebsite(site: Website): Promise<Website> {
        const db = await this.ensureData();
        if (!site.categoryId && db.categories.length > 0) {
            site.categoryId = db.categories[0].id;
        }
        db.websites.push(site);
        await this.saveData();
        return site;
    }

    async updateWebsite(id: string, updates: Partial<Website>): Promise<boolean> {
        const db = await this.ensureData();
        const index = db.websites.findIndex((w: Website) => w.id === id);
        if (index !== -1) {
            db.websites[index] = { ...db.websites[index], ...updates };
            await this.saveData();
            return true;
        }
        return false;
    }

    async deleteWebsite(id: string): Promise<boolean> {
        const db = await this.ensureData();
        const initialLen = db.websites.length;
        db.websites = db.websites.filter((w: Website) => w.id !== id);
        if (db.websites.length < initialLen) {
            await this.saveData();
            return true;
        }
        return false;
    }

    async getCategories(): Promise<Category[]> {
        const db = await this.ensureData();
        return db.categories;
    }

    async addCategory(category: Category): Promise<Category> {
        const db = await this.ensureData();
        db.categories.push(category);
        await this.saveData();
        return category;
    }

    async updateCategory(id: string, name: string): Promise<boolean> {
        const db = await this.ensureData();
        const category = db.categories.find((c: Category) => c.id === id);
        if (category) {
            category.name = name;
            await this.saveData();
            return true;
        }
        return false;
    }

    async deleteCategory(id: string): Promise<boolean> {
        const db = await this.ensureData();
        if (db.categories.length <= 1) return false;

        db.categories = db.categories.filter((c: Category) => c.id !== id);

        const fallbackId = db.categories[0].id;
        db.websites.forEach((w: Website) => {
            if (w.categoryId === id) w.categoryId = fallbackId;
        });

        await this.saveData();
        return true;
    }

    async getTheme(): Promise<Theme> {
        const db = await this.ensureData();
        return db.config?.theme || 'minimal';
    }

    async setTheme(theme: Theme): Promise<void> {
        const db = await this.ensureData();
        if (!db.config) db.config = {};
        db.config.theme = theme;
        await this.saveData();
    }
}

// --- Factory ---
const isVercelKVEnabled = !!process.env.KV_REST_API_URL;
console.log('[Storage] Using adapter:', isVercelKVEnabled ? 'Vercel KV' : 'Local File');

export const storage: DataStore = isVercelKVEnabled ? new VercelKVStore() : new FileStore();
