import type { NextApiRequest, NextApiResponse } from 'next';

import { generateCaptchaToken } from '../../../utils/captcha';

function generateCaptcha() {
  const num1 = Math.floor(Math.random() * 10);
  const num2 = Math.floor(Math.random() * 10);
  const answer = num1 + num2;
  return { num1, num2, answer };
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { num1, num2, answer } = generateCaptcha();
  const token = generateCaptchaToken(answer);

  res.status(200).json({ num1, num2, token });
}
