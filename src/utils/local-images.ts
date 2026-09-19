import fs from 'node:fs/promises';
import path from 'node:path';
import { writeFileAtomically } from './atomic-file';

const publicPath = path.join(process.cwd(), 'public');
const manifestPath = path.join(publicPath, 'images/.cache-manifest.json');
type ImageManifest = Record<string, string>;
let manifestWriteQueue: Promise<void> = Promise.resolve();

async function readManifest(): Promise<ImageManifest> {
  try {
    return JSON.parse(await fs.readFile(manifestPath, 'utf8')) as ImageManifest;
  } catch {
    return {};
  }
}

async function recordManifestEntry(localPath: string, remoteUrl: string): Promise<void> {
  const write = manifestWriteQueue.then(async () => {
    const manifest = await readManifest();
    manifest[localPath] = remoteUrl;
    await writeFileAtomically(manifestPath, JSON.stringify(manifest, null, 2));
  });
  manifestWriteQueue = write.catch(() => undefined);
  await write;
}

/** Caches a remote image at a stable local path and skips downloads for the same source URL. */
export async function cacheLocalImage(remoteUrl: string | undefined, localPath: string): Promise<string | undefined> {
  if (!remoteUrl) return undefined;
  const destination = path.join(publicPath, localPath.replace(/^\//, ''));
  const manifest = await readManifest();

  try {
    await fs.access(destination);
    if (manifest[localPath] === remoteUrl) return localPath;
  } catch {
    // The image is missing and must be downloaded.
  }

  try {
    await fs.mkdir(path.dirname(destination), { recursive: true });
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
    const temporaryPath = `${destination}.${process.pid}.tmp`;
    await fs.writeFile(temporaryPath, bytes);
    await fs.rename(temporaryPath, destination);
    await recordManifestEntry(localPath, remoteUrl);
    return localPath;
  } catch (error) {
    console.error(`[Image Cache] Failed for ${localPath}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}
