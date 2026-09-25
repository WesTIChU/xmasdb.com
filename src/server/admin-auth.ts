import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const ADMIN_SESSION_COOKIE = 'xmasdb_admin_session';
export const ADMIN_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ADMIN_LOGIN_LIMIT = 5;
export const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;

interface SessionRecord {
  expiresAt: number;
}

export interface AdminAuthConfig {
  password?: string;
  secret?: string;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function isAdminConfigured(config: AdminAuthConfig): boolean {
  return Boolean(config.password && config.secret);
}

export class AdminAuth {
  private readonly sessions = new Map<string, SessionRecord>();

  constructor(private readonly config: AdminAuthConfig) {}

  isConfigured(): boolean {
    return isAdminConfigured(this.config);
  }

  verifyPassword(password: unknown): boolean {
    return typeof password === 'string' && Boolean(this.config.password) && safeEqual(password, this.config.password!);
  }

  createCookie(now = Date.now()): string {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = now + ADMIN_SESSION_TTL_MS;
    this.sessions.set(token, { expiresAt });
    const signature = this.sign(token);
    return `${token}.${signature}`;
  }

  authenticate(cookieValue: string | undefined, now = Date.now()): boolean {
    if (!cookieValue || !this.config.secret) return false;
    const separator = cookieValue.lastIndexOf('.');
    if (separator < 1) return false;
    const token = cookieValue.slice(0, separator);
    const signature = cookieValue.slice(separator + 1);
    if (!safeEqual(signature, this.sign(token))) return false;
    const session = this.sessions.get(token);
    if (!session || session.expiresAt <= now) {
      this.sessions.delete(token);
      return false;
    }
    return true;
  }

  revoke(cookieValue: string | undefined): void {
    if (!cookieValue) return;
    const separator = cookieValue.lastIndexOf('.');
    if (separator > 0) this.sessions.delete(cookieValue.slice(0, separator));
  }

  private sign(value: string): string {
    return createHmac('sha256', this.config.secret || '').update(value).digest('base64url');
  }
}

export class AdminLoginRateLimiter {
  private readonly failures = new Map<string, number[]>();

  allow(ip: string, now = Date.now()): boolean {
    const recent = (this.failures.get(ip) || []).filter((timestamp) => now - timestamp < ADMIN_LOGIN_WINDOW_MS);
    this.failures.set(ip, recent);
    return recent.length < ADMIN_LOGIN_LIMIT;
  }

  recordFailure(ip: string, now = Date.now()): void {
    const recent = (this.failures.get(ip) || []).filter((timestamp) => now - timestamp < ADMIN_LOGIN_WINDOW_MS);
    recent.push(now);
    this.failures.set(ip, recent);
  }

  clear(ip: string): void {
    this.failures.delete(ip);
  }
}

export class AdminMutationRateLimiter {
  private readonly attempts = new Map<string, number[]>();

  allow(ip: string, now = Date.now()): boolean {
    const recent = (this.attempts.get(ip) || []).filter((timestamp) => now - timestamp < ADMIN_LOGIN_WINDOW_MS);
    if (recent.length >= ADMIN_LOGIN_LIMIT) {
      this.attempts.set(ip, recent);
      return false;
    }
    recent.push(now);
    this.attempts.set(ip, recent);
    return true;
  }
}

export function cookieOptions(isProduction: boolean): string {
  return `Path=/; Max-Age=${ADMIN_SESSION_TTL_MS / 1000}; HttpOnly; SameSite=Lax${isProduction ? '; Secure' : ''}`;
}

export function clearCookieOptions(isProduction: boolean): string {
  return `Path=/; Max-Age=0; HttpOnly; SameSite=Lax${isProduction ? '; Secure' : ''}`;
}

export function getAdminLoginRedirect(auth: AdminAuth, cookieValue: string | undefined): string | undefined {
  return auth.authenticate(cookieValue) ? '/admin/submissions/' : undefined;
}

export function isSameOriginMutation(req: { headers: Record<string, string | string[] | undefined>; protocol: string; get(name: string): string | undefined }): boolean {
  const origin = req.headers.origin;
  const forwardedProtocol = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProtocol || req.protocol;
  const host = req.get('host');
  if (!host || (protocol !== 'http' && protocol !== 'https')) return false;

  const matchesExpectedOrigin = (value: string): boolean => {
    try {
      const parsed = new URL(value);
      return parsed.host === host && parsed.protocol === `${protocol}:`;
    } catch {
      return false;
    }
  };

  if (origin !== undefined) return typeof origin === 'string' && matchesExpectedOrigin(origin);
  const referer = req.headers.referer;
  return typeof referer === 'string' && matchesExpectedOrigin(referer);
}
