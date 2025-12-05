import crypto from 'crypto';

const CAPTCHA_SECRET = process.env.CAPTCHA_SECRET || 'default-secret-key-change-me';

export function generateCaptchaToken(answer: number): string {
    // Create a signature of the answer
    // We can include a timestamp to prevent replay attacks if we want, but for now simple answer validation is a good step up.
    // Format: "timestamp:hashed_value"
    const timestamp = Date.now();
    const data = `${answer}:${timestamp}`;
    const signature = crypto.createHmac('sha256', CAPTCHA_SECRET).update(data).digest('hex');
    return `${data}:${signature}`;
}

export function verifyCaptchaToken(token: string, userAnswer: string): boolean {
    try {
        const [answerStr, timestampStr, signature] = token.split(':');

        // Check if token is well-formed
        if (!answerStr || !timestampStr || !signature) return false;

        // Check expiration (e.g. 5 minutes)
        const timestamp = parseInt(timestampStr, 10);
        if (Date.now() - timestamp > 5 * 60 * 1000) return false;

        // Verify signature
        const data = `${answerStr}:${timestampStr}`;
        const expectedSignature = crypto.createHmac('sha256', CAPTCHA_SECRET).update(data).digest('hex');

        if (expectedSignature !== signature) return false;

        // Verify answer
        return parseInt(answerStr, 10) === parseInt(userAnswer, 10);
    } catch (error) {
        return false;
    }
}
