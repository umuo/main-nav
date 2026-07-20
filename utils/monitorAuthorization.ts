import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextApiRequest } from 'next';
import { verifyJwt } from './auth';

const bearerToken = (req: NextApiRequest) => {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return null;

  const token = authorization.slice('Bearer '.length);
  return token.length > 0 ? token : null;
};

const hasValidBearerSecret = (
  req: NextApiRequest,
  secret: string | undefined,
  minLength: number
) => {
  const received = bearerToken(req);
  const expected = secret?.trim();
  if (
    !received
    || !expected
    || expected.length < minLength
    || expected.includes('replace-with-')
  ) {
    return false;
  }

  const expectedDigest = createHash('sha256').update(expected).digest();
  const receivedDigest = createHash('sha256').update(received).digest();
  return timingSafeEqual(expectedDigest, receivedDigest);
};

export const hasAdminSession = (req: NextApiRequest) => {
  const token = req.cookies.auth_token;
  return Boolean(token && verifyJwt(token));
};

export const hasValidAdminApiToken = (req: NextApiRequest) => (
  hasValidBearerSecret(req, process.env.ADMIN_API_TOKEN, 32)
);

export const hasAdminAccess = (req: NextApiRequest) => (
  hasValidAdminApiToken(req) || hasAdminSession(req)
);

export const hasValidCronSecret = (req: NextApiRequest) => (
  hasValidBearerSecret(req, process.env.CRON_SECRET, 16)
);
