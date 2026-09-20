import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { writeFileAtomically } from './atomic-file';

const publicPath = path.join(process.cwd(), 'public');
type ImageManifest = Record<string, string>;
let manifestWriteQueue: Promise<void> = Promise.resolve();

async function readManifest(manifestPath = defaultManifestPath()): Promise<ImageManifest> {
  try {
    return JSON.parse(await fs.readFile(manifestPath, 'utf8')) as ImageManifest;
  } catch {
    return {};
  }
}

function defaultManifestPath(): string {
  return path.join(publicPath, 'images/.cache-manifest.json');
}

async function recordManifestEntry(localPath: string, remoteUrl: string, manifestPath = defaultManifestPath()): Promise<void> {
  const write = manifestWriteQueue.then(async () => {
    const manifest = await readManifest(manifestPath);
    manifest[localPath] = remoteUrl;
    await writeFileAtomically(manifestPath, JSON.stringify(manifest, null, 2));
  });
  manifestWriteQueue = write.catch(() => undefined);
  await write;
}

export interface LocalImageCacheOptions {
  publicRoot?: string;
  manifestPath?: string;
}

function versionedImagePath(localPath: string, remoteUrl: string): string {
  const dot = localPath.lastIndexOf('.');
  const suffix = createHash('sha256').update(remoteUrl).digest('hex').slice(0, 12);
  return dot > localPath.lastIndexOf('/')
    ? `${localPath.slice(0, dot)}-${suffix}${localPath.slice(dot)}`
    : `${localPath}-${suffix}`;
}

/** Caches a remote image, changing its local identity only when the source URL changes. */
export async function cacheLocalImage(remoteUrl: string | undefined, localPath: string, options: LocalImageCacheOptions = {}): Promise<string | undefined> {
  if (!remoteUrl) return undefined;
  const root = options.publicRoot || publicPath;
  const manifestPath = options.manifestPath || path.join(root, 'images/.cache-manifest.json');
  const manifest = await readManifest(manifestPath);
  let resolvedPath = localPath;
  const destination = () => path.join(root, resolvedPath.replace(/^\//, ''));

  try {
    await fs.access(destination());
    if (manifest[localPath] === remoteUrl) return localPath;
    resolvedPath = versionedImagePath(localPath, remoteUrl);
    if (manifest[resolvedPath] === remoteUrl) {
      await fs.access(destination());
      return resolvedPath;
    }
  } catch {
    // The image is missing and must be downloaded.
  }

  try {
    await fs.mkdir(path.dirname(destination()), { recursive: true });
    let bytes: Buffer | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(remoteUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        bytes = Buffer.from(await response.arrayBuffer());
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
    if (!bytes) throw lastError || new Error('image download failed');
    const temporaryPath = `${destination()}.${process.pid}.tmp`;
    await fs.writeFile(temporaryPath, bytes);
    await fs.rename(temporaryPath, destination());
    await recordManifestEntry(resolvedPath, remoteUrl, manifestPath);
    return resolvedPath;
  } catch (error) {
    console.error(`[Image Cache] Failed for ${resolvedPath}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}
