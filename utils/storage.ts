import { Website, Theme, Category } from '../types';
import { prisma } from './prisma';

// --- Prisma Store Implementation ---
class PrismaStore {
    async getWebsites(): Promise<Website[]> {
        const sites = await prisma.website.findMany();
        return sites.map(s => ({
            id: s.id,
            title: s.title,
            url: s.url,
            description: s.description || '',
            iconUrl: s.iconUrl || '',
            status: (s.status as 'online' | 'offline' | 'checking' | 'unknown') || 'unknown',
            lastChecked: s.lastChecked,
            latency: s.latency || undefined,
            categoryId: s.categoryId || 'default'
        }));
    }

    async addWebsite(site: Website): Promise<Website> {
        // Ensure category exists
        const categoryId = site.categoryId || (await this.getDefaultCategoryId());

        await prisma.website.create({
            data: {
                id: site.id,
                title: site.title,
                url: site.url,
                description: site.description,
                iconUrl: site.iconUrl,
                status: site.status,
                lastChecked: site.lastChecked,
                latency: site.latency || null,
                categoryId: categoryId
            }
        });
        return { ...site, categoryId };
    }

    async updateWebsite(id: string, updates: Partial<Website>): Promise<boolean> {
        try {
            await prisma.website.update({
                where: { id },
                data: {
                    title: updates.title,
                    url: updates.url,
                    description: updates.description,
                    iconUrl: updates.iconUrl,
                    status: updates.status,
                    lastChecked: updates.lastChecked,
                    latency: updates.latency,
                    categoryId: updates.categoryId
                }
            });
            return true;
        } catch {
            return false;
        }
    }

    async deleteWebsite(id: string): Promise<boolean> {
        try {
            await prisma.website.delete({ where: { id } });
            return true;
        } catch {
            return false;
        }
    }

    async getCategories(): Promise<Category[]> {
        const categories = await prisma.category.findMany();
        if (categories.length === 0) {
            // Seed default
            const defaultCat = await prisma.category.create({
                data: { id: 'default', name: 'General' }
            });
            return [defaultCat];
        }
        return categories;
    }

    async addCategory(category: Category): Promise<Category> {
        return await prisma.category.create({
            data: {
                id: category.id,
                name: category.name
            }
        });
    }

    async updateCategory(id: string, name: string): Promise<boolean> {
        try {
            await prisma.category.update({
                where: { id },
                data: { name }
            });
            return true;
        } catch {
            return false;
        }
    }

    async deleteCategory(id: string): Promise<boolean> {
        const count = await prisma.category.count();
        if (count <= 1) return false;

        try {
            // Reassign websites to default or another category
            // For simplicity, we'll just fail if websites exist or require a transaction.
            // Using a simple strategy: Find another category to move stats to.
            const other = await prisma.category.findFirst({
                where: { id: { not: id } }
            });

            if (!other) return false; // Should not happen given count check

            await prisma.website.updateMany({
                where: { categoryId: id },
                data: { categoryId: other.id }
            });

            await prisma.category.delete({ where: { id } });
            return true;
        } catch {
            return false;
        }
    }

    async getTheme(): Promise<Theme> {
        const config = await prisma.config.findUnique({
            where: { key: 'theme' }
        });
        return (config?.value as Theme) || 'minimal';
    }

    async setTheme(theme: Theme): Promise<void> {
        await prisma.config.upsert({
            where: { key: 'theme' },
            update: { value: theme },
            create: { key: 'theme', value: theme }
        });
    }

    private async getDefaultCategoryId(): Promise<string> {
        const first = await prisma.category.findFirst();
        if (first) return first.id;
        const newCat = await prisma.category.create({ data: { id: 'default', name: 'General' } });
        return newCat.id;
    }
}

export const storage = new PrismaStore();
