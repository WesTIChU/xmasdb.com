import crypto from 'node:crypto';

const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_LIMIT = 60;

// Cloudflare publishes these ranges for the edge addresses that can connect to
// the origin. Forwarded client headers are trusted only when the peer is here.
const CLOUDFLARE_RANGES = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2c0f:f248::/32',
  '2a06:98c0::/29',
] as const;

interface ParsedRange {
  network: bigint;
  mask: bigint;
  bits: number;
}

function parseIp(ip: string): { value: bigint; bits: number } | null {
  const clean = ip.replace(/^::ffff:/i, '');
  const octets = clean.split('.');
  if (octets.length === 4 && octets.every((octet) => /^\d+$/.test(octet) && Number(octet) <= 255)) {
    return {
      value: octets.reduce((value, octet) => (value << 8n) | BigInt(octet), 0n),
      bits: 32,
    };
  }

  if (!clean.includes(':')) return null;
  const halves = clean.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  if (left.some((part) => !/^[0-9a-f]{1,4}$/i.test(part)) || right.some((part) => !/^[0-9a-f]{1,4}$/i.test(part))) return null;
  const groups = halves.length === 2
    ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right]
    : [...left];
  if (groups.length !== 8) return null;
  return { value: groups.reduce((value, group) => (value << 16n) | BigInt(`0x${group}`), 0n), bits: 128 };
}

function parseRange(value: string): ParsedRange | null {
  const [ip, prefix] = value.split('/');
  const parsed = parseIp(ip);
  const length = Number(prefix);
  if (!parsed || !Number.isInteger(length) || length < 0 || length > parsed.bits) return null;
  const mask = length === 0 ? 0n : ((1n << BigInt(parsed.bits)) - 1n) ^ ((1n << BigInt(parsed.bits - length)) - 1n);
  return { network: parsed.value & mask, mask, bits: parsed.bits };
}

const parsedCloudflareRanges = CLOUDFLARE_RANGES.map(parseRange).filter((range): range is ParsedRange => Boolean(range));

export function isTrustedProxyAddress(ip: string | undefined): boolean {
  const parsed = ip ? parseIp(ip) : null;
  return Boolean(parsed && parsedCloudflareRanges.some((range) => range.bits === parsed.bits && (parsed.value & range.mask) === range.network));
}

export function getFeedRateLimit(): number {
  const configured = Number(process.env.XMASDB_FEED_RATE_LIMIT || DEFAULT_LIMIT);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_LIMIT;
}

interface Reservation {
  complete(statusCode: number): void;
}

export class PublicFeedRateLimiter {
  private readonly requests = new Map<string, number[]>();

  constructor(private readonly limit = getFeedRateLimit(), private readonly windowMs = HOUR_MS) {}

  reserve(clientIp: string, feedId: string, now = Date.now()): { reservation: Reservation | null; retryAfterSeconds: number } {
    const key = `${crypto.createHash('sha256').update(clientIp).digest('hex')}:${feedId}`;
    const timestamps = (this.requests.get(key) || []).filter((timestamp) => timestamp > now - this.windowMs);
    if (timestamps.length >= this.limit) {
      const oldest = timestamps[0] || now;
      return { reservation: null, retryAfterSeconds: Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000)) };
    }

    timestamps.push(now);
    this.requests.set(key, timestamps);
    let completed = false;
    return {
      reservation: {
        complete: (statusCode) => {
          if (completed || statusCode >= 200 && statusCode < 300) return;
          completed = true;
          const current = this.requests.get(key) || [];
          const index = current.indexOf(now);
          if (index >= 0) current.splice(index, 1);
          if (current.length === 0) this.requests.delete(key);
          else this.requests.set(key, current);
        },
      },
      retryAfterSeconds: 0,
    };
  }
}
