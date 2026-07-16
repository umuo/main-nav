import crypto from 'crypto';
import { ConfigurationError, requireEnv } from './env';

const CAPTCHA_TTL_MS = 5 * 60 * 1000;

function getEncryptionKey(): Buffer {
    const secret = requireEnv('CAPTCHA_SECRET', 32);
    if (secret === process.env.JWT_SECRET) {
        throw new ConfigurationError('CAPTCHA_SECRET must be different from JWT_SECRET');
    }
    return crypto.createHash('sha256').update(secret).digest();
}

export function generateCaptchaToken(answer: number): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
    const payload = JSON.stringify({ answer, expiresAt: Date.now() + CAPTCHA_TTL_MS });
    const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [iv, encrypted, tag].map(part => part.toString('base64url')).join('.');
}

export function verifyCaptchaToken(token: string, userAnswer: string): boolean {
    try {
        if (!/^\d+$/.test(userAnswer)) return false;

        const parts = token.split('.');
        if (parts.length !== 3) return false;

        const [iv, encrypted, tag] = parts.map(part => Buffer.from(part, 'base64url'));
        if (iv.length !== 12 || tag.length !== 16 || encrypted.length === 0) return false;

        const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
        decipher.setAuthTag(tag);
        const payload = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
        const data = JSON.parse(payload) as { answer?: unknown; expiresAt?: unknown };

        if (typeof data.answer !== 'number' || typeof data.expiresAt !== 'number' || Date.now() > data.expiresAt) {
            return false;
        }

        return data.answer === Number(userAnswer);
    } catch (error) {
        if (error instanceof ConfigurationError) throw error;
        return false;
    }
}
