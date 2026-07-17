import { ClientConnectivity } from '../types';

export const CLIENT_PROBE_TIMEOUT_MS = 30_000;

type TargetAddressSpace = 'local' | 'loopback';

interface ClientProbeOptions {
  allowPermissionPrompt?: boolean;
  timeoutMs?: number;
}

interface LocalNetworkRequestInit extends RequestInit {
  targetAddressSpace?: TargetAddressSpace;
}

const getTargetAddressSpace = (hostname: string): TargetAddressSpace | undefined => {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');

  if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized === '::1') {
    return 'loopback';
  }

  const ipv4Parts = normalized.split('.').map(part => Number(part));
  if (ipv4Parts.length === 4 && ipv4Parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [first, second] = ipv4Parts;
    if (first === 127) return 'loopback';
    if (
      first === 10 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 169 && second === 254)
    ) {
      return 'local';
    }
  }

  if (normalized.endsWith('.local') || /^(fc|fd|fe[89ab])/i.test(normalized)) {
    return 'local';
  }

  return undefined;
};

const readLocalNetworkPermission = async (addressSpace: TargetAddressSpace): Promise<PermissionState | undefined> => {
  if (typeof navigator === 'undefined' || !navigator.permissions) return undefined;

  try {
    const name = addressSpace === 'loopback' ? 'loopback-network' : 'local-network';
    const permission = await navigator.permissions.query({ name } as unknown as PermissionDescriptor);
    return permission.state;
  } catch {
    try {
      const permission = await navigator.permissions.query({
        name: 'local-network-access',
      } as unknown as PermissionDescriptor);
      return permission.state;
    } catch {
      // Older browsers do not know these permission names and can still attempt the request.
      return undefined;
    }
  }
};

export const getFaviconUrl = (url: string): string => {
  try {
    const domain = new URL(url).origin;
    return `${domain}/favicon.ico`;
  } catch {
    return 'https://via.placeholder.com/48?text=WEB';
  }
};

/**
 * Checks reachability from the current browser. Cross-origin responses are opaque,
 * so a successful request means "reachable from this device", not "HTTP 2xx".
 */
export const probeWebsiteFromBrowser = async (
  url: string,
  options: ClientProbeOptions = {}
): Promise<ClientConnectivity> => {
  const { allowPermissionPrompt = false, timeoutMs = CLIENT_PROBE_TIMEOUT_MS } = options;
  const checkedAt = Date.now();
  let target: URL;

  try {
    target = new URL(url);
  } catch {
    return { status: 'unknown', lastChecked: checkedAt, reason: 'unsupported-url' };
  }

  if (!['http:', 'https:'].includes(target.protocol)) {
    return { status: 'unknown', lastChecked: checkedAt, reason: 'unsupported-url' };
  }

  if (typeof window === 'undefined') {
    return { status: 'unknown', lastChecked: checkedAt, reason: 'unsupported-url' };
  }

  const targetAddressSpace = getTargetAddressSpace(target.hostname);
  const isCrossOrigin = target.origin !== window.location.origin;

  if (window.location.protocol === 'https:' && target.protocol === 'http:' && !targetAddressSpace) {
    return { status: 'unknown', lastChecked: checkedAt, reason: 'mixed-content' };
  }

  if (targetAddressSpace && isCrossOrigin) {
    if (!window.isSecureContext) {
      return { status: 'unknown', lastChecked: checkedAt, reason: 'insecure-context' };
    }

    const permissionState = await readLocalNetworkPermission(targetAddressSpace);
    if (permissionState === 'denied') {
      return { status: 'unknown', lastChecked: checkedAt, reason: 'local-network-denied' };
    }
    if (permissionState === 'prompt' && !allowPermissionPrompt) {
      return { status: 'unknown', lastChecked: checkedAt, reason: 'local-network-permission-required' };
    }
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { status: 'offline', lastChecked: checkedAt, reason: 'browser-offline' };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();

  try {
    const requestInit: LocalNetworkRequestInit = {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
      ...(targetAddressSpace && isCrossOrigin ? { targetAddressSpace } : {}),
    };
    await fetch(target.href, requestInit);

    return {
      status: 'online',
      lastChecked: Date.now(),
      latency: Math.max(1, Math.round(performance.now() - startedAt)),
    };
  } catch (error) {
    return {
      status: 'offline',
      lastChecked: Date.now(),
      reason: error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'network-error',
    };
  } finally {
    window.clearTimeout(timeout);
  }
};
