import { createHash, createHmac } from 'node:crypto';

export interface R2StorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface R2RemoteObject {
  key: string;
  size: number;
  etag?: string;
  sha256?: string;
  contentType?: string;
}

export interface R2EnsureResult {
  remote: R2RemoteObject;
  uploaded: boolean;
  verified: true;
}

export class R2StorageError extends Error {
  constructor(message: string, public readonly operation: string, public readonly objectKey?: string) {
    super(message);
    this.name = 'R2StorageError';
  }
}

const managedPathPattern = /^\/images\/(posters|backdrops|people|optimized\/posters|optimized\/people)\/(.+)$/;
const mimeTypes: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

export function managedObjectKey(canonicalPath: string): string {
  const match = canonicalPath.match(managedPathPattern);
  if (!match) throw new R2StorageError(`Not a managed canonical image path: ${canonicalPath}`, 'map-key');
  return `${match[1]}/${match[2]}`;
}

export function isManagedCanonicalPath(value: string | undefined): boolean {
  return Boolean(value && managedPathPattern.test(value));
}

export function contentTypeForImagePath(filePath: string): string {
  return mimeTypes[filePath.slice(filePath.lastIndexOf('.')).toLowerCase()] || 'application/octet-stream';
}

export function r2ConfigFromEnv(): R2StorageConfig {
  const required = (name: string): string => {
    const value = process.env[name]?.trim();
    if (!value) throw new R2StorageError(`${name} is required.`, 'configuration');
    return value;
  };
  return {
    accountId: required('R2_ACCOUNT_ID'),
    accessKeyId: required('R2_ACCESS_KEY_ID'),
    secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
    bucket: process.env.R2_BUCKET_NAME?.trim() || 'xmasdb-images',
  };
}

function hmacSha256(key: Buffer | string, value: string): Buffer { return createHmac('sha256', key).update(value).digest(); }
function hash(value: string | Uint8Array): string { return createHash('sha256').update(value).digest('hex'); }
function awsEncode(value: string): string { return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`); }
function canonicalUri(key = ''): string { return `/${awsEncode(key).replace(/%2F/g, '/')}`; }
function canonicalQuery(parameters: Record<string, string>): string {
  return Object.entries(parameters).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${awsEncode(key)}=${awsEncode(value)}`).join('&');
}
function xmlUnescape(value: string): string { return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"); }

export class R2Storage {
  constructor(private readonly config: R2StorageConfig) {}

  private endpoint(): string { return `https://${this.config.accountId}.r2.cloudflarestorage.com`; }

  private async signedRequest(method: string, key = '', options: { query?: Record<string, string>; body?: Uint8Array; contentType?: string; sha256?: string } = {}): Promise<Response> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').replace('Z', 'Z');
    const date = amzDate.slice(0, 8);
    const body = options.body || new Uint8Array();
    const payloadHash = hash(body);
    const host = `${this.config.accountId}.r2.cloudflarestorage.com`;
    const headers: Record<string, string> = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
    if (options.contentType) headers['content-type'] = options.contentType;
    if (options.sha256) headers['x-amz-meta-sha256'] = options.sha256;
    const signedHeaders = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaders.map((header) => `${header}:${headers[header].trim()}\n`).join('');
    const query = canonicalQuery(options.query || {});
    const requestTarget = `${this.endpoint()}/${this.config.bucket}${canonicalUri(key)}${query ? `?${query}` : ''}`;
    const canonicalRequest = [method, `/${awsEncode(this.config.bucket)}${canonicalUri(key)}`, query, canonicalHeaders, signedHeaders.join(';'), payloadHash].join('\n');
    const credentialScope = `${date}/auto/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, hash(canonicalRequest)].join('\n');
    const signingKey = hmacSha256(hmacSha256(hmacSha256(hmacSha256(`AWS4${this.config.secretAccessKey}`, date), 'auto'), 's3'), 'aws4_request');
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders.join(';')}, Signature=${hmacSha256(signingKey, stringToSign).toString('hex')}`;
    return fetch(requestTarget, { method, headers, body: method === 'PUT' ? Buffer.from(body) as BodyInit : undefined });
  }

  async headObject(key: string): Promise<R2RemoteObject | undefined> {
    const response = await this.signedRequest('HEAD', key);
    if (response.status === 404) return undefined;
    if (!response.ok) throw new R2StorageError(`HEAD failed: HTTP ${response.status}`, 'head', key);
    return { key, size: Number(response.headers.get('content-length') || 0), etag: response.headers.get('etag')?.replace(/^"|"$/g, ''), sha256: response.headers.get('x-amz-meta-sha256') || undefined, contentType: response.headers.get('content-type') || undefined };
  }

  async listObjects(): Promise<R2RemoteObject[]> {
    const objects: R2RemoteObject[] = [];
    let continuationToken: string | undefined;
    do {
      const query: Record<string, string> = { 'list-type': '2' };
      if (continuationToken) query['continuation-token'] = continuationToken;
      const response = await this.signedRequest('GET', '', { query });
      if (!response.ok) throw new R2StorageError(`ListObjectsV2 failed: HTTP ${response.status}`, 'list');
      const xml = await response.text();
      for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
        const item = match[1] || '';
        objects.push({ key: xmlUnescape(item.match(/<Key>([\s\S]*?)<\/Key>/)?.[1] || ''), size: Number(item.match(/<Size>(\d+)<\/Size>/)?.[1] || 0), etag: item.match(/<ETag>([\s\S]*?)<\/ETag>/)?.[1]?.replace(/^"|"$/g, '') });
      }
      continuationToken = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1];
    } while (continuationToken);
    return objects;
  }

  async uploadAndVerify(key: string, body: Uint8Array, contentType: string): Promise<R2RemoteObject> {
    const sha256 = hash(body);
    const response = await this.signedRequest('PUT', key, { body, contentType, sha256 });
    if (!response.ok) throw new R2StorageError(`PUT failed: HTTP ${response.status}`, 'upload', key);
    const remote = await this.headObject(key);
    if (!remote) throw new R2StorageError('Object was not present after upload.', 'verify', key);
    if (remote.size !== body.byteLength) throw new R2StorageError(`Size verification failed: ${remote.size} != ${body.byteLength}`, 'verify', key);
    if (remote.sha256 && remote.sha256 !== sha256) throw new R2StorageError('SHA-256 verification failed.', 'verify', key);
    if (remote.contentType?.split(';')[0] !== contentType) throw new R2StorageError(`Content type verification failed: ${remote.contentType || 'missing'} != ${contentType}`, 'verify', key);
    return remote;
  }

  async ensureUploadedAndVerified(key: string, body: Uint8Array, contentType: string): Promise<R2EnsureResult> {
    const sha256 = hash(body);
    const existing = await this.headObject(key);
    if (existing && existing.size === body.byteLength && existing.sha256 === sha256 && existing.contentType?.split(';')[0] === contentType) return { remote: existing, uploaded: false, verified: true };
    return { remote: await this.uploadAndVerify(key, body, contentType), uploaded: true, verified: true };
  }
}

export function createR2Storage(config = r2ConfigFromEnv()): R2Storage { return new R2Storage(config); }
