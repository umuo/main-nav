import { Website, Theme, Category } from '../types';
import { put, list } from '@vercel/blob';
import fs from 'fs/promises';
import path from 'path';

// --- Data Structure ---
interface DbSchema {
    websites: Website[];
    categories: Category[];
    config: {
        theme: Theme;
    };
}

const DEFAULT_DB: DbSchema = {
    websites: [],
    categories: [{ id: 'default', name: 'General' }],
    config: { theme: 'minimal' }
};

// --- Abstract JSON Store ---
abstract class JsonDbStore {
    protected memoryCache: DbSchema | null = null;
    protected lastFetch: number = 0;
    protected CACHE_TTL = 1000 * 60; // 1 minute cache for read (optional optimization, strict consistent for now = 0)

    // Abstract methods to be implemented by adapters
    protected abstract loadRaw(): Promise<DbSchema | null>;
    protected abstract saveRaw(data: DbSchema): Promise<void>;

    private async ensureData(): Promise<DbSchema> {
        // Simple caching strategy: Always fetch fresh for now to avoid consistency issues in serverless
        // In a high traffic app, we'd need better locking or accept checking staleness.
        // Given this is a personal usage app, fetching every time is safer.

        const data = await this.loadRaw();
        if (data) {
            this.memoryCache = data;
        } else {
            // Init new DB
            this.memoryCache = JSON.parse(JSON.stringify(DEFAULT_DB));
            await this.saveRaw(this.memoryCache!);
        }
        return this.memoryCache!;
    }

    private async saveData() {
        if (this.memoryCache) {
            await this.saveRaw(this.memoryCache);
        }
    }

    // Public Interface Implementation
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
        const index = db.websites.findIndex(w => w.id === id);
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
        db.websites = db.websites.filter(w => w.id !== id);
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
        const category = db.categories.find(c => c.id === id);
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

        db.categories = db.categories.filter(c => c.id !== id);

        const fallbackId = db.categories[0].id;
        db.websites.forEach(w => {
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
        if (!db.config) db.config = { theme: 'minimal' };
        db.config.theme = theme;
        await this.saveData();
    }
}

// --- Vercel Blob Implementation ---
// Stores data in a single 'db.json' file in the blob store.
class VercelBlobStore extends JsonDbStore {
    private fileName = 'db.json';
    private token = process.env.BLOB_READ_WRITE_TOKEN || process.env.nav_READ_WRITE_TOKEN;

    protected async loadRaw(): Promise<DbSchema | null> {
        try {
            // 1. List files to find our db.json
            const { blobs } = await list({
                limit: 1,
                prefix: this.fileName,
                token: this.token
            });
            const blob = blobs.find(b => b.pathname === this.fileName);

            if (!blob) return null;

            // 2. Fetch content
            const response = await fetch(blob.url);
            if (!response.ok) throw new Error('Failed to fetch DB');

            return await response.json();
        } catch (error) {
            console.error('Blob load error:', error);
            return null;
        }
    }

    protected async saveRaw(data: DbSchema): Promise<void> {
        try {
            // Overwrite the file. 
            // access: 'public' is required for simple download, but means anyone can read if they guess URL.
            // For a private app, this is "okay" if URL is secret, but technically 'public' blobs are public.
            // Ideally we'd use private if Vercel Blob supported it easily for server-side reading without token hassle, 
            // but 'public' is standard for vercel/blob currently unless configured otherwise.
            await put(this.fileName, JSON.stringify(data), {
                access: 'public',
                addRandomSuffix: false, // Crucial: Keep the name constant!
                token: this.token,
                cacheControlMaxAge: 0, // Ensure fresh content
                // @ts-ignore - types might be slightly outdated in some envs, but valid option
                allowOverwrite: true
            });
        } catch (error) {
            console.error('Blob save error:', error);
            throw error;
        }
    }
}

// --- Local File Implementation ---
class FileStore extends JsonDbStore {
    private filePath = path.join(process.cwd(), 'data', 'db.json');

    protected async loadRaw(): Promise<DbSchema | null> {
        try {
            const data = await fs.readFile(this.filePath, 'utf-8');
            return JSON.parse(data);
        } catch {
            return null;
        }
    }

    protected async saveRaw(data: DbSchema): Promise<void> {
        const dir = path.dirname(this.filePath);
        try {
            await fs.access(dir);
        } catch {
            await fs.mkdir(dir, { recursive: true });
        }
        await fs.writeFile(this.filePath, JSON.stringify(data, null, 2));
    }
}

// --- Factory ---
// Use Blob if BLOB_READ_WRITE_TOKEN is present (Vercel standard env), otherwise local file.
// Note: User can explicitly fallback to file by not setting the token locally.
const isBlobEnabled = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.nav_READ_WRITE_TOKEN);
console.log('[Storage] Using adapter:', isBlobEnabled ? 'Vercel Blob' : 'Local File');

export const storage = isBlobEnabled ? new VercelBlobStore() : new FileStore();
