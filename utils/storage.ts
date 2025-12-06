import { Website, Theme } from '../types';

// Global storage object
// referencing globalThis to ensure it persists across hot-reloads in dev (mostly)
// though in serverless it resets per lambda instance.

declare global {
    var mockDb: {
        websites: Website[];
        config: { [key: string]: string };
    } | undefined;
}

if (!global.mockDb) {
    global.mockDb = {
        websites: [],
        config: { theme: 'minimal' }
    };
}

const db = global.mockDb!;

export const storage = {
    getWebsites: () => {
        return db.websites;
    },

    addWebsite: (site: Website) => {
        // Simple check for duplicates by URL? User didn't strictly ask, but good practice.
        // But for now just append as per "Import" logic before.
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

    getTheme: (): Theme => {
        return (db.config.theme as Theme) || 'minimal';
    },

    setTheme: (theme: Theme) => {
        db.config.theme = theme;
    }
};
