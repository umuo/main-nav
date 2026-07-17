import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { signJwt, setAuthCookie } from '../../../utils/auth';
import { ConfigurationError, requireEnv } from '../../../utils/env';
import { clearLoginThrottle, checkLoginThrottle, recordLoginFailure } from '../../../utils/loginThrottle';
import { verifyTurnstileToken } from '../../../utils/turnstile';

const firstHeaderValue = (value: string | string[] | undefined) => (
  Array.isArray(value) ? value[0] : value
);

const getClientIp = (req: NextApiRequest) => {
  if (process.env.TRUST_PROXY_HEADERS === 'true') {
    const connectingIp = firstHeaderValue(req.headers['cf-connecting-ip']);
    const realIp = firstHeaderValue(req.headers['x-real-ip']);
    const forwardedIp = firstHeaderValue(req.headers['x-forwarded-for'])?.split(',')[0]?.trim();
    const proxyIp = connectingIp || realIp || forwardedIp;
    if (proxyIp) return proxyIp.slice(0, 128);
  }

  return (req.socket.remoteAddress || 'unknown').slice(0, 128);
};

const sendRateLimit = (res: NextApiResponse, retryAfterSeconds: number) => {
  res.setHeader('Retry-After', String(retryAfterSeconds));
  return res.status(429).json({ error: 'Too many login attempts', retryAfter: retryAfterSeconds });
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;
  const clientIp = getClientIp(req);
  const userAgent = firstHeaderValue(req.headers['user-agent']) || 'unknown';
  const throttleClientKey = clientIp === 'unknown' ? `unknown|${userAgent.slice(0, 256)}` : clientIp;
  res.setHeader('Cache-Control', 'no-store');

  try {
    const adminUsername = requireEnv('ADMIN_USERNAME');
    const adminPasswordHash = requireEnv('ADMIN_PASSWORD_HASH');
    const throttle = await checkLoginThrottle(throttleClientKey);
    if (!throttle.allowed) {
      return sendRateLimit(res, throttle.retryAfterSeconds);
    }

    const verification = await verifyTurnstileToken(req.body.turnstileToken, clientIp);
    if (!verification.success) {
      if (verification.unavailable) {
        console.error(`Turnstile verification unavailable: ${verification.errorCodes.join(', ')}`);
        return res.status(503).json({ error: 'Human verification unavailable' });
      }

      const failedThrottle = await recordLoginFailure(throttleClientKey);
      if (!failedThrottle.allowed) {
        return sendRateLimit(res, failedThrottle.retryAfterSeconds);
      }
      return res.status(400).json({ error: 'Invalid human verification' });
    }

    if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(adminPasswordHash)) {
      throw new ConfigurationError('ADMIN_PASSWORD_HASH is not a valid bcrypt hash');
    }

    const isPasswordValid = typeof password === 'string' && await bcrypt.compare(password, adminPasswordHash);
    if (username === adminUsername && isPasswordValid) {
      await clearLoginThrottle(throttleClientKey);
      const token = signJwt({ username: adminUsername, role: 'admin' });
      setAuthCookie(res, token);
      return res.status(200).json({ success: true });
    }

    const failedThrottle = await recordLoginFailure(throttleClientKey);
    if (!failedThrottle.allowed) {
      return sendRateLimit(res, failedThrottle.retryAfterSeconds);
    }
    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(`Authentication configuration error: ${error.message}`);
      return res.status(500).json({ error: 'Authentication is not configured' });
    }
    console.error('Authentication service error:', error);
    return res.status(503).json({ error: 'Authentication temporarily unavailable' });
  }
}
