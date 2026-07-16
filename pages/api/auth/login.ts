import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { verifyCaptchaToken } from '../../../utils/captcha';
import { signJwt, setAuthCookie } from '../../../utils/auth';
import { ConfigurationError, requireEnv } from '../../../utils/env';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;

  try {
    const adminUsername = requireEnv('ADMIN_USERNAME');
    const adminPasswordHash = requireEnv('ADMIN_PASSWORD_HASH');
    const { captchaToken, captchaAnswer } = req.body;

    if (typeof captchaToken !== 'string' || typeof captchaAnswer !== 'string' || !verifyCaptchaToken(captchaToken, captchaAnswer)) {
      return res.status(400).json({ error: 'Invalid captcha' });
    }

    if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(adminPasswordHash)) {
      throw new ConfigurationError('ADMIN_PASSWORD_HASH is not a valid bcrypt hash');
    }

    const isPasswordValid = typeof password === 'string' && await bcrypt.compare(password, adminPasswordHash);
    if (username === adminUsername && isPasswordValid) {
      const token = signJwt({ username: adminUsername, role: 'admin' });
      setAuthCookie(res, token);
      return res.status(200).json({ success: true });
    }

    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(`Authentication configuration error: ${error.message}`);
      return res.status(500).json({ error: 'Authentication is not configured' });
    }
    throw error;
  }
}
