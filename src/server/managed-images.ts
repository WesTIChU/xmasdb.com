import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { cacheLocalImage, type ImageRefreshBudget, type LocalImageCacheOptions } from '../utils/local-images';
import { contentTypeForImagePath, createR2Storage, managedObjectKey, R2Storage, R2StorageError, type R2EnsureResult } from './r2-storage';

export class ManagedImageIngestionError extends Error {
  constructor(message: string, public readonly canonicalPath: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ManagedImageIngestionError';
  }
}

export interface ManagedImagePublicationResult {
  canonicalPath: string;
  uploaded: boolean;
  skipped: boolean;
  verified: true;
}

export function summarizeManagedImagePublication(results: ManagedImagePublicationResult[]): { uploaded: number; skipped: number; verified: number } {
  return {
    uploaded: results.filter((result) => result.uploaded).length,
    skipped: results.filter((result) => result.skipped).length,
    verified: results.filter((result) => result.verified).length,
  };
}

export interface ManagedImageIngestionOptions extends LocalImageCacheOptions {
  publicRoot?: string;
  storage?: Pick<R2Storage, 'ensureUploadedAndVerified'>;
  cacheImage?: typeof cacheLocalImage;
  processImage?: (absolutePath: string) => Promise<void>;
}

/** Downloads/caches, publishes, and verifies a managed image before returning its canonical path. */
export async function ingestManagedImage(remoteUrl: string | undefined, canonicalPath: string, options: ManagedImageIngestionOptions = {}): Promise<string> {
  if (!remoteUrl) throw new ManagedImageIngestionError('No source image URL was supplied.', canonicalPath);
  const objectKey = managedObjectKey(canonicalPath);
  const publicRoot = options.publicRoot || path.join(process.cwd(), 'public');
  const cacheImage = options.cacheImage || cacheLocalImage;
  const localPath = await cacheImage(remoteUrl, canonicalPath, options);
  if (!localPath) throw new ManagedImageIngestionError('Local image processing/cache failed.', canonicalPath);
  try {
    const absolutePath = path.join(publicRoot, localPath.replace(/^\//, ''));
    await options.processImage?.(absolutePath);
    const bytes = await fs.readFile(absolutePath);
    await (options.storage || createR2Storage()).ensureUploadedAndVerified(objectKey, bytes, contentTypeForImagePath(localPath));
    return localPath;
  } catch (error) {
    if (error instanceof ManagedImageIngestionError) throw error;
    const detail = error instanceof R2StorageError || error instanceof Error ? error.message : String(error);
    throw new ManagedImageIngestionError(`R2 publication failed for ${objectKey}: ${detail}`, canonicalPath, error);
  }
}

/** Publishes an already-generated local derivative without changing canonical data. */
export async function publishManagedImageFile(localPath: string, canonicalPath: string, options: { publicRoot?: string; storage?: Pick<R2Storage, 'ensureUploadedAndVerified' | 'headObject'>; overwriteExisting?: boolean } = {}): Promise<ManagedImagePublicationResult> {
  const objectKey = managedObjectKey(canonicalPath);
  const publicRoot = options.publicRoot || path.join(process.cwd(), 'public');
  try {
    const bytes = await fs.readFile(path.join(publicRoot, localPath.replace(/^\//, '')));
    const storage = options.storage || createR2Storage();
    if (options.overwriteExisting === false) {
      const existing = await storage.headObject(objectKey);
      if (existing) {
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        if (existing.size !== bytes.byteLength || existing.sha256 !== sha256 || existing.contentType?.split(';')[0] !== contentTypeForImagePath(localPath)) {
          throw new R2StorageError(`Refusing to overwrite existing object ${objectKey}.`, 'publish-create-only', objectKey);
        }
        return { canonicalPath, uploaded: false, skipped: true, verified: true };
      }
    }
    const result: R2EnsureResult = await storage.ensureUploadedAndVerified(objectKey, bytes, contentTypeForImagePath(localPath));
    return { canonicalPath, uploaded: result.uploaded, skipped: !result.uploaded, verified: result.verified };
  } catch (error) {
    const detail = error instanceof R2StorageError || error instanceof Error ? error.message : String(error);
    throw new ManagedImageIngestionError(`R2 publication failed for ${objectKey}: ${detail}`, canonicalPath, error);
  }
}
