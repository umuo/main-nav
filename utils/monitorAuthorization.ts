import { timingSafeEqual } from 'node:crypto';
import type { NextApiRequest } from 'next';
import { verifyJwt } from './auth';

export const hasAdminSession = (req: NextApiRequest) => {
  const token = req.cookies.auth_token;
  return Boolean(token && verifyJwt(token));
};

export const hasValidCronSecret = (req: NextApiRequest) => {
  const secret = process.env.CRON_SECRET;
  const authorization = req.headers.authorization;
  if (!secret || secret.length < 16 || !authorization) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);
  return expected.length === received.length && timingSafeEqual(expected, received);
};
