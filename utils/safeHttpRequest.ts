import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 5;

export class UnsafeUrlError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UnsafeUrlError';
    }
}

interface ResolvedTarget {
    url: URL;
    address: string;
    family: 4 | 6;
}

export interface ProbeResult {
    status: 'online' | 'offline';
    statusCode: number;
    latency: number;
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

    // IPv4-mapped IPv6 addresses must inherit the IPv4 safety decision.
    if (groups.slice(0, 5).every(group => group === 0) && groups[5] === 0xffff) {
        const ipv4 = `${groups[6] >>> 8}.${groups[6] & 0xff}.${groups[7] >>> 8}.${groups[7] & 0xff}`;
        return isPublicIpv4(ipv4);
    }

    // Only globally routable unicast space is accepted.
    if ((groups[0] & 0xe000) !== 0x2000) return false;

    // Documentation, Teredo, benchmarking/ORCHID and 6to4 ranges are not valid targets.
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

async function withDeadline<T>(operation: Promise<T>, deadline: number): Promise<T> {
    const remainingTime = deadline - Date.now();
    if (remainingTime <= 0) throw new Error('Request timed out');

    let timer: NodeJS.Timeout | undefined;
    try {
        return await Promise.race([
            operation,
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error('Request timed out')), remainingTime);
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
        return { url, address: hostname, family: literalFamily as 4 | 6 };
    }

    let addresses: Array<{ address: string; family: number }>;
    try {
        addresses = await withDeadline(dns.lookup(hostname, { all: true, verbatim: true }), deadline);
    } catch {
        throw new Error('DNS lookup failed');
    }

    if (addresses.length === 0) throw new Error('DNS lookup returned no addresses');
    if (addresses.some(result => !isPublicIpAddress(result.address))) {
        throw new UnsafeUrlError('Hostname resolves to a private or reserved IP address');
    }

    const selected = addresses[0];
    return { url, address: selected.address, family: selected.family as 4 | 6 };
}

async function requestOnce(
    input: string | URL,
    method: 'HEAD' | 'GET',
    redirects = 0,
    deadline = Date.now() + REQUEST_TIMEOUT_MS
): Promise<{ ok: boolean; statusCode: number }> {
    if (redirects > MAX_REDIRECTS) throw new Error('Too many redirects');
    if (Date.now() >= deadline) throw new Error('Request timed out');

    const target = await resolveTarget(input, deadline);
    if (Date.now() >= deadline) throw new Error('Request timed out');
    const transport = target.url.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
        const request = transport.request({
            protocol: target.url.protocol,
            hostname: target.address,
            family: target.family,
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
                    reject(new Error('Invalid redirect URL'));
                    return;
                }

                requestOnce(redirectUrl, method, redirects + 1, deadline).then(resolve, reject);
                return;
            }

            resolve({ ok: statusCode >= 200 && statusCode < 300, statusCode });
        });

        const remainingTime = Math.max(1, deadline - Date.now());
        request.setTimeout(remainingTime, () => request.destroy(new Error('Request timed out')));
        request.on('error', reject);
        request.end();
    });
}

export async function probePublicWebsite(url: string): Promise<ProbeResult> {
    const startedAt = Date.now();
    const deadline = startedAt + REQUEST_TIMEOUT_MS;
    let result: { ok: boolean; statusCode: number } | null = null;

    try {
        result = await requestOnce(url, 'HEAD', 0, deadline);
    } catch (error) {
        if (error instanceof UnsafeUrlError) throw error;
    }

    if (!result?.ok) {
        try {
            result = await requestOnce(url, 'GET', 0, deadline);
        } catch (error) {
            if (error instanceof UnsafeUrlError) throw error;
            result = null;
        }
    }

    return {
        status: result?.ok ? 'online' : 'offline',
        statusCode: result?.statusCode || 0,
        latency: Date.now() - startedAt,
    };
}
