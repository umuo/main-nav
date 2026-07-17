import crypto from 'crypto';
import { prisma } from './prisma';
import { requireEnv } from './env';

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const BLOCK_DURATION_MS = 15 * 60 * 1000;
const THROTTLE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FAILURES = 5;

export interface LoginThrottleStatus {
  allowed: boolean;
  retryAfterSeconds: number;
}

const allowedStatus = (): LoginThrottleStatus => ({ allowed: true, retryAfterSeconds: 0 });

const hashClientKey = (clientKey: string) => crypto
  .createHmac('sha256', requireEnv('JWT_SECRET', 32))
  .update(`login-throttle:${clientKey}`)
  .digest('hex');

export async function checkLoginThrottle(clientKey: string): Promise<LoginThrottleStatus> {
  const now = Date.now();
  const key = hashClientKey(clientKey);
  const record = await prisma.loginThrottle.findUnique({ where: { key } });

  if (!record) return allowedStatus();

  const blockedUntil = Number(record.blockedUntil);
  if (blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil - now) / 1000)),
    };
  }

  if (now - Number(record.windowStartedAt) >= ATTEMPT_WINDOW_MS) {
    await prisma.loginThrottle.deleteMany({
      where: { key, windowStartedAt: record.windowStartedAt },
    });
  }

  return allowedStatus();
}

export async function recordLoginFailure(clientKey: string): Promise<LoginThrottleStatus> {
  const now = Date.now();
  const key = hashClientKey(clientKey);
  const nowValue = BigInt(now);
  const attemptWindowValue = BigInt(ATTEMPT_WINDOW_MS);
  const blockedUntilValue = BigInt(now + BLOCK_DURATION_MS);

  // The atomic upsert prevents parallel requests from losing failure increments.
  const [record] = await prisma.$queryRaw<Array<{ blockedUntil: bigint }>>`
    INSERT INTO "LoginThrottle" (
      "key", "failures", "windowStartedAt", "blockedUntil", "updatedAt"
    ) VALUES (${key}, 1, ${nowValue}::bigint, 0::bigint, ${nowValue}::bigint)
    ON CONFLICT ("key") DO UPDATE SET
      "failures" = CASE
        WHEN ${nowValue}::bigint - "LoginThrottle"."windowStartedAt" >= ${attemptWindowValue}::bigint THEN 1
        ELSE "LoginThrottle"."failures" + 1
      END,
      "windowStartedAt" = CASE
        WHEN ${nowValue}::bigint - "LoginThrottle"."windowStartedAt" >= ${attemptWindowValue}::bigint THEN ${nowValue}::bigint
        ELSE "LoginThrottle"."windowStartedAt"
      END,
      "blockedUntil" = CASE
        WHEN (
          CASE
            WHEN ${nowValue}::bigint - "LoginThrottle"."windowStartedAt" >= ${attemptWindowValue}::bigint THEN 1
            ELSE "LoginThrottle"."failures" + 1
          END
        ) >= ${MAX_FAILURES} THEN ${blockedUntilValue}::bigint
        ELSE 0::bigint
      END,
      "updatedAt" = ${nowValue}::bigint
    RETURNING "blockedUntil"
  `;

  const blockedUntil = Number(record.blockedUntil);
  const status = blockedUntil > now
    ? {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((blockedUntil - now) / 1000)),
      }
    : allowedStatus();

  await prisma.loginThrottle.deleteMany({
    where: { updatedAt: { lt: BigInt(now - THROTTLE_RETENTION_MS) } },
  });

  return status;
}

export async function clearLoginThrottle(clientKey: string): Promise<void> {
  await prisma.loginThrottle.deleteMany({ where: { key: hashClientKey(clientKey) } });
}
