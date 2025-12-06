import { Website, Theme, Category } from '../types';

// Global storage object
// referencing globalThis to ensure it persists across hot-reloads in dev (mostly)
// though in serverless it resets per lambda instance.

declare global {
    var mockDb: {
        websites: Website[];
        config: { [key: string]: string };
        categories: Category[];
    } | undefined;
}

if (!global.mockDb) {
    global.mockDb = {
        websites: [],
        config: { theme: 'minimal' },
        categories: [
            { id: 'default', name: 'General' }
        ]
    };
}

const db = global.mockDb!;

export const storage = {
    getWebsites: () => {
        return db.websites;
    },

    addWebsite: (site: Website) => {
        // Default to first category if none specified
        if (!site.categoryId && db.categories.length > 0) {
            site.categoryId = db.categories[0].id;
        }
        db.websites.push(site);
        return site;
    },

    updateWebsite: (id: string, updates: Partial<Website>) => {
        const index = db.websites.findIndex(w => w.id === id);
        if (index !== -1) {
            db.websites[index] = { ...db.websites[index], ...updates };
            return true;
        }
        return false;
    },

    deleteWebsite: (id: string) => {
        const initialLength = db.websites.length;
        db.websites = db.websites.filter(w => w.id !== id);
        return db.websites.length < initialLength;
    },

    getCategories: () => {
        return db.categories;
    },

    addCategory: (category: Category) => {
        db.categories.push(category);
        return category;
    },

    updateCategory: (id: string, name: string) => {
        const category = db.categories.find(c => c.id === id);
        if (category) {
            category.name = name;
            return true;
        }
        return false;
    },

    deleteCategory: (id: string) => {
        // Prevent deleting the last category or default?
        // Let's prevent deleting if it's the only one.
        if (db.categories.length <= 1) return false;

        db.categories = db.categories.filter(c => c.id !== id);

        // Re-assign sites in this category to the first available category
        const fallbackId = db.categories[0].id;
        db.websites.forEach(w => {
            if (w.categoryId === id) {
                w.categoryId = fallbackId;
            }
        });

        return true;
    },

    getTheme: (): Theme => {
        return (db.config.theme as Theme) || 'minimal';
    },

    setTheme: (theme: Theme) => {
        db.config.theme = theme;
    }
};
