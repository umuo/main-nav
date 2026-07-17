
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const databasePoolSize = () => {
    const configured = Number.parseInt(process.env.DATABASE_POOL_MAX || '', 10);
    return Number.isFinite(configured) ? Math.min(10, Math.max(1, configured)) : 3;
};

const prismaClientSingleton = () => {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: databasePoolSize(),
        connectionTimeoutMillis: 10_000,
        idleTimeoutMillis: 10_000,
        allowExitOnIdle: true,
    });
    pool.on('error', error => {
        console.error('Unexpected idle database connection error', {
            name: error.name,
            ...('code' in error ? { code: String(error.code) } : {}),
        });
    });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
