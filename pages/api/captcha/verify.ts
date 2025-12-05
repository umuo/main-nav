import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyCaptchaToken } from '../../../utils/captcha';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, answer } = req.body;
  const isValid = verifyCaptchaToken(token, answer);

  res.status(200).json({ valid: isValid });
}
