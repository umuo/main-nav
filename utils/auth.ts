import { NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';
import { requireEnv } from './env';

export function signJwt(payload: object) {
    return jwt.sign(payload, requireEnv('JWT_SECRET', 32), { algorithm: 'HS256', expiresIn: '24h' });
}

export function verifyJwt(token: string) {
    const secret = requireEnv('JWT_SECRET', 32);
    try {
        return jwt.verify(token, secret, { algorithms: ['HS256'] });
    } catch {
        return null;
    }
}

export function setAuthCookie(res: NextApiResponse, token: string) {
    const cookie = serialize('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
    });
    res.setHeader('Set-Cookie', cookie);
}

export function clearAuthCookie(res: NextApiResponse) {
    const cookie = serialize('auth_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: -1,
        path: '/',
    });
    res.setHeader('Set-Cookie', cookie);
}
