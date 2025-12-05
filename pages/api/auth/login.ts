import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { verifyCaptchaToken } from '../../../utils/captcha';
import { signJwt, setAuthCookie } from '../../../utils/auth';

// 默认 hash (密码: admin123)
const DEFAULT_HASH = '$2a$10$o32YRX3kfcC4mgmHVewr/.cMWj5EORQGWA.mvswBOdpZ65tzmcFze';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;

  const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
  const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || DEFAULT_HASH;

  console.log('Hash from env:', ADMIN_PASSWORD_HASH);

  const { captchaToken, captchaAnswer } = req.body;
  if (!verifyCaptchaToken(captchaToken, captchaAnswer)) {
    return res.status(400).json({ error: 'Invalid captcha' });
  }

  const isPasswordValid = bcrypt.compareSync(password, ADMIN_PASSWORD_HASH);
  console.log('Password valid:', isPasswordValid);

  if (username === ADMIN_USERNAME && isPasswordValid) {
    const token = signJwt({ username: ADMIN_USERNAME, role: 'admin' });
    setAuthCookie(res, token);
    return res.status(200).json({ success: true });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
}
