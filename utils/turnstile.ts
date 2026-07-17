import { randomUUID } from 'crypto';
import { ConfigurationError, requireEnv } from './env';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SITEVERIFY_TIMEOUT_MS = 8_000;
const MAX_TOKEN_LENGTH = 2_048;
const EXPECTED_ACTION = 'admin_login';
const OFFICIAL_TEST_SECRETS = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
]);

interface SiteverifyResponse {
  success?: boolean;
  hostname?: string;
  action?: string;
  'error-codes'?: string[];
}

export interface HumanVerificationResult {
  success: boolean;
  unavailable: boolean;
  errorCodes: string[];
}

const getAllowedHostnames = () => (
  process.env.TURNSTILE_ALLOWED_HOSTNAMES
    ?.split(',')
    .map(hostname => hostname.trim().toLowerCase())
    .filter(Boolean) || []
);

export async function verifyTurnstileToken(
  token: unknown,
  remoteIp?: string
): Promise<HumanVerificationResult> {
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
    return { success: false, unavailable: false, errorCodes: ['invalid-input-response'] };
  }

  const secret = requireEnv('TURNSTILE_SECRET_KEY');
  const isOfficialTestSecret = OFFICIAL_TEST_SECRETS.has(secret);
  if (process.env.NODE_ENV === 'production' && isOfficialTestSecret) {
    throw new ConfigurationError('TURNSTILE_SECRET_KEY must not use an official test key in production');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SITEVERIFY_TIMEOUT_MS);

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        response: token,
        remoteip: remoteIp,
        idempotency_key: randomUUID(),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { success: false, unavailable: true, errorCodes: ['siteverify-http-error'] };
    }

    const result = await response.json() as SiteverifyResponse;
    if (!result.success) {
      return {
        success: false,
        unavailable: result['error-codes']?.includes('internal-error') || false,
        errorCodes: result['error-codes'] || ['invalid-input-response'],
      };
    }

    if (!isOfficialTestSecret && result.action !== EXPECTED_ACTION) {
      return { success: false, unavailable: false, errorCodes: ['action-mismatch'] };
    }

    const allowedHostnames = getAllowedHostnames();
    if (
      allowedHostnames.length > 0 &&
      (!result.hostname || !allowedHostnames.includes(result.hostname.toLowerCase()))
    ) {
      return { success: false, unavailable: false, errorCodes: ['hostname-mismatch'] };
    }

    return { success: true, unavailable: false, errorCodes: [] };
  } catch {
    return { success: false, unavailable: true, errorCodes: ['siteverify-network-error'] };
  } finally {
    clearTimeout(timeout);
  }
}
