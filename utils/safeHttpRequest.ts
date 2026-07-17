import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

const REQUEST_TIMEOUT_MS = 30_000;
const ADDRESS_ATTEMPT_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

export type ServerProbeFailureReason =
    | 'connect-error'
    | 'dns-error'
    | 'http-error'
    | 'timeout'
    | 'tls-error';

export class UnsafeUrlError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UnsafeUrlError';
    }
}

class ProbeRequestError extends Error {
    constructor(public readonly reason: ServerProbeFailureReason, message: string) {
        super(message);
        this.name = 'ProbeRequestError';
    }
}

interface ResolvedAddress {
    address: string;
    family: 4 | 6;
}

interface ResolvedTarget {
    url: URL;
    addresses: ResolvedAddress[];
}

interface RequestResult {
    statusCode: number;
}

export interface ProbeResult {
    status: 'online' | 'offline';
    statusCode: number;
    latency: number;
    reason?: ServerProbeFailureReason;
}

function ipv4ToNumber(address: string): number | null {
    const octets = address.split('.').map(Number);
    if (octets.length !== 4 || octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
        return null;
    }

    return (((octets[0] << 24) >>> 0) + (octets[1] << 16) + (octets[2] << 8) + octets[3]) >>> 0;
}

function isInIpv4Cidr(value: number, base: number, prefix: number): boolean {
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (value & mask) === (base & mask);
}

function isPublicIpv4(address: string): boolean {
    const value = ipv4ToNumber(address);
    if (value === null) return false;

    const blockedRanges: Array<[string, number]> = [
        ['0.0.0.0', 8],
        ['10.0.0.0', 8],
        ['100.64.0.0', 10],
        ['127.0.0.0', 8],
        ['169.254.0.0', 16],
        ['172.16.0.0', 12],
        ['192.0.0.0', 24],
        ['192.0.2.0', 24],
        ['192.31.196.0', 24],
        ['192.52.193.0', 24],
        ['192.88.99.0', 24],
        ['192.168.0.0', 16],
        ['192.175.48.0', 24],
        ['198.18.0.0', 15],
        ['198.51.100.0', 24],
        ['203.0.113.0', 24],
        ['224.0.0.0', 4],
        ['240.0.0.0', 4],
    ];

    return !blockedRanges.some(([base, prefix]) => {
        const baseValue = ipv4ToNumber(base);
        return baseValue !== null && isInIpv4Cidr(value, baseValue, prefix);
    });
}

function parseIpv6(address: string): number[] | null {
    let input = address.toLowerCase().split('%')[0];

    if (input.includes('.')) {
        const lastColon = input.lastIndexOf(':');
        const ipv4 = ipv4ToNumber(input.slice(lastColon + 1));
        if (lastColon < 0 || ipv4 === null) return null;
        input = `${input.slice(0, lastColon)}:${(ipv4 >>> 16).toString(16)}:${(ipv4 & 0xffff).toString(16)}`;
    }

    const halves = input.split('::');
    if (halves.length > 2) return null;

    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
    const missing = 8 - left.length - right.length;

    if ((halves.length === 1 && missing !== 0) || missing < 0) return null;

    const groups = [
        ...left,
        ...Array(halves.length === 2 ? missing : 0).fill('0'),
        ...right,
    ].map(group => Number.parseInt(group, 16));

    if (groups.length !== 8 || groups.some(group => !Number.isInteger(group) || group < 0 || group > 0xffff)) {
        return null;
    }

    return groups;
}

function isPublicIpv6(address: string): boolean {
    const groups = parseIpv6(address);
    if (!groups) return false;

    if (groups.slice(0, 5).every(group => group === 0) && groups[5] === 0xffff) {
        const ipv4 = `${groups[6] >>> 8}.${groups[6] & 0xff}.${groups[7] >>> 8}.${groups[7] & 0xff}`;
        return isPublicIpv4(ipv4);
    }

    if ((groups[0] & 0xe000) !== 0x2000) return false;
    if (groups[0] === 0x2001 && (groups[1] <= 0x01ff || groups[1] === 0x0db8)) return false;
    if (groups[0] === 0x2002) return false;

    return true;
}

export function isPublicIpAddress(address: string): boolean {
    const version = net.isIP(address);
    if (version === 4) return isPublicIpv4(address);
    if (version === 6) return isPublicIpv6(address);
    return false;
}

const isTimeoutError = (error: unknown) => (
    error instanceof ProbeRequestError && error.reason === 'timeout'
);

const classifyNetworkError = (error: unknown): ProbeRequestError => {
    if (error instanceof ProbeRequestError) return error;

    const code = typeof error === 'object' && error && 'code' in error
        ? String(error.code)
        : '';
    if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
        return new ProbeRequestError('timeout', 'Request timed out');
    }
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
        return new ProbeRequestError('dns-error', 'DNS lookup failed');
    }
    if (
        code.startsWith('ERR_TLS') ||
        code.includes('CERT') ||
        code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
        code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
    ) {
        return new ProbeRequestError('tls-error', 'TLS validation failed');
    }
    return new ProbeRequestError('connect-error', 'Connection failed');
};

async function withDeadline<T>(operation: Promise<T>, deadline: number): Promise<T> {
    const remainingTime = deadline - Date.now();
    if (remainingTime <= 0) throw new ProbeRequestError('timeout', 'Request timed out');

    let timer: NodeJS.Timeout | undefined;
    try {
        return await Promise.race([
            operation,
            new Promise<never>((_, reject) => {
                timer = setTimeout(
                    () => reject(new ProbeRequestError('timeout', 'Request timed out')),
                    remainingTime
                );
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function resolveTarget(input: string | URL, deadline: number): Promise<ResolvedTarget> {
    let url: URL;
    try {
        url = input instanceof URL ? input : new URL(input);
    } catch {
        throw new UnsafeUrlError('Invalid URL');
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new UnsafeUrlError('Only HTTP and HTTPS URLs are allowed');
    }
    if (url.username || url.password) {
        throw new UnsafeUrlError('URLs containing credentials are not allowed');
    }

    const expectedPort = url.protocol === 'https:' ? '443' : '80';
    if (url.port && url.port !== expectedPort) {
        throw new UnsafeUrlError('Only standard HTTP and HTTPS ports are allowed');
    }

    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (
        hostname === 'localhost' ||
        (!net.isIP(hostname) && !hostname.includes('.')) ||
        ['.localhost', '.local', '.internal', '.home', '.lan', '.test', '.example', '.invalid']
            .some(suffix => hostname.endsWith(suffix))
    ) {
        throw new UnsafeUrlError('Local hostnames are not allowed');
    }

    const literalFamily = net.isIP(hostname);
    if (literalFamily) {
        if (!isPublicIpAddress(hostname)) throw new UnsafeUrlError('Private or reserved IP addresses are not allowed');
        return {
            url,
            addresses: [{ address: hostname, family: literalFamily as 4 | 6 }],
        };
    }

    let addresses: Array<{ address: string; family: number }>;
    try {
        addresses = await withDeadline(dns.lookup(hostname, { all: true, verbatim: true }), deadline);
    } catch (error) {
        if (isTimeoutError(error)) throw error;
        throw new ProbeRequestError('dns-error', 'DNS lookup failed');
    }

    if (addresses.length === 0) throw new ProbeRequestError('dns-error', 'DNS lookup returned no addresses');
    if (addresses.some(result => !isPublicIpAddress(result.address))) {
        throw new UnsafeUrlError('Hostname resolves to a private or reserved IP address');
    }

    return {
        url,
        addresses: addresses
            .map(result => ({ address: result.address, family: result.family as 4 | 6 }))
            .sort((left, right) => left.family - right.family),
    };
}

function requestAddress(
    target: ResolvedTarget,
    resolved: ResolvedAddress,
    method: 'HEAD' | 'GET',
    redirects: number,
    deadline: number
): Promise<RequestResult> {
    const remainingTime = deadline - Date.now();
    if (remainingTime <= 0) return Promise.reject(new ProbeRequestError('timeout', 'Request timed out'));

    const attemptTimeout = Math.min(ADDRESS_ATTEMPT_TIMEOUT_MS, remainingTime);
    const transport = target.url.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (callback: () => void) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            callback();
        };

        const request = transport.request({
            protocol: target.url.protocol,
            hostname: resolved.address,
            family: resolved.family,
            port: target.url.port || (target.url.protocol === 'https:' ? 443 : 80),
            method,
            path: `${target.url.pathname}${target.url.search}`,
            servername: net.isIP(target.url.hostname.replace(/^\[|\]$/g, '')) ? undefined : target.url.hostname,
            headers: {
                Host: target.url.host,
                Accept: '*/*',
                Connection: 'close',
                'User-Agent': 'Mozilla/5.0 (compatible; SentinelNav/1.0)',
            },
        }, response => {
            const statusCode = response.statusCode || 0;
            const location = response.headers.location;
            response.destroy();

            if (location && [301, 302, 303, 307, 308].includes(statusCode)) {
                let redirectUrl: URL;
                try {
                    redirectUrl = new URL(location, target.url);
                } catch {
                    finish(() => reject(new ProbeRequestError('connect-error', 'Invalid redirect URL')));
                    return;
                }

                finish(() => {
                    requestOnce(redirectUrl, method, redirects + 1, deadline).then(resolve, reject);
                });
                return;
            }

            finish(() => resolve({ statusCode }));
        });

        const timer = setTimeout(() => {
            request.destroy(new ProbeRequestError('timeout', 'Request timed out'));
        }, attemptTimeout);

        request.on('error', error => finish(() => reject(classifyNetworkError(error))));
        request.end();
    });
}

async function requestOnce(
    input: string | URL,
    method: 'HEAD' | 'GET',
    redirects = 0,
    deadline = Date.now() + REQUEST_TIMEOUT_MS
): Promise<RequestResult> {
    if (redirects > MAX_REDIRECTS) throw new ProbeRequestError('connect-error', 'Too many redirects');
    if (Date.now() >= deadline) throw new ProbeRequestError('timeout', 'Request timed out');

    const target = await resolveTarget(input, deadline);
    let lastError: ProbeRequestError | undefined;

    for (const resolved of target.addresses) {
        try {
            return await requestAddress(target, resolved, method, redirects, deadline);
        } catch (error) {
            lastError = classifyNetworkError(error);
            if (Date.now() >= deadline) break;
        }
    }

    throw lastError || new ProbeRequestError('connect-error', 'No reachable address');
}

const isReachableStatus = (statusCode: number) => statusCode >= 100 && statusCode < 500;

export async function probePublicWebsite(url: string): Promise<ProbeResult> {
    const startedAt = Date.now();
    const deadline = startedAt + REQUEST_TIMEOUT_MS;
    let result: RequestResult | null = null;
    let failure: ProbeRequestError | undefined;

    try {
        result = await requestOnce(url, 'HEAD', 0, deadline);
    } catch (error) {
        if (error instanceof UnsafeUrlError) throw error;
        failure = classifyNetworkError(error);
    }

    if (!result || !isReachableStatus(result.statusCode)) {
        try {
            result = await requestOnce(url, 'GET', 0, deadline);
            failure = undefined;
        } catch (error) {
            if (error instanceof UnsafeUrlError) throw error;
            failure = classifyNetworkError(error);
            result = null;
        }
    }

    const statusCode = result?.statusCode || 0;
    const online = isReachableStatus(statusCode);

    return {
        status: online ? 'online' : 'offline',
        statusCode,
        latency: Date.now() - startedAt,
        ...(!online ? { reason: failure?.reason || 'http-error' } : {}),
    };
}
