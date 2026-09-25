import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { writeFileAtomically } from './atomic-file';
import { isTmdbFresh, TMDB_MIGRATION_BATCH_SIZE } from './tmdb-freshness';

const publicPath = path.join(process.cwd(), 'public');
export interface ImageManifestEntry {
  remoteUrl: string;
  fetchedAt?: string;
}

type ImageManifest = Record<string, ImageManifestEntry>;
let manifestWriteQueue: Promise<void> = Promise.resolve();

export interface ImageRefreshBudget {
  remaining: number;
  attempted: number;
  succeeded: number;
  failed: number;
  byType: Record<'posters' | 'backdrops' | 'people', { attempted: number; succeeded: number; failed: number }>;
  failureDetails: Array<{ localPath: string; message: string }>;
}

export function createImageRefreshBudget(limit = TMDB_MIGRATION_BATCH_SIZE): ImageRefreshBudget {
  const empty = () => ({ attempted: 0, succeeded: 0, failed: 0 });
  return { remaining: limit, attempted: 0, succeeded: 0, failed: 0, byType: { posters: empty(), backdrops: empty(), people: empty() }, failureDetails: [] };
}

const defaultRefreshBudget = createImageRefreshBudget();

async function readManifest(manifestPath = defaultManifestPath()): Promise<ImageManifest> {
  try {
    const raw = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as Record<string, string | ImageManifestEntry>;
    return Object.fromEntries(Object.entries(raw).map(([localPath, entry]) => [
      localPath,
      typeof entry === 'string' ? { remoteUrl: entry } : entry,
    ]));
  } catch {
    return {};
  }
}

function defaultManifestPath(): string {
  return path.join(publicPath, 'images/.cache-manifest.json');
}

async function recordManifestEntry(localPath: string, remoteUrl: string, fetchedAt: string, manifestPath = defaultManifestPath()): Promise<void> {
  const write = manifestWriteQueue.then(async () => {
    const manifest = await readManifest(manifestPath);
    manifest[localPath] = { remoteUrl, fetchedAt };
    await writeFileAtomically(manifestPath, JSON.stringify(manifest, null, 2));
  });
  manifestWriteQueue = write.catch(() => undefined);
  await write;
}

export interface LocalImageCacheOptions {
  publicRoot?: string;
  manifestPath?: string;
  refreshBudget?: ImageRefreshBudget;
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
  const refreshBudget = options.refreshBudget || defaultRefreshBudget;
  let resolvedPath = localPath;
  const destination = () => path.join(root, resolvedPath.replace(/^\//, ''));

  try {
    await fs.access(destination());
    const existing = manifest[localPath];
    if (existing?.remoteUrl === remoteUrl) {
      if (isTmdbFresh(existing.fetchedAt)) return localPath;
      if (refreshBudget.remaining <= 0) return localPath;
      refreshBudget.remaining -= 1;
      return await downloadImage(remoteUrl, root, localPath, manifestPath, refreshBudget);
    }
    if (!existing) {
      if (refreshBudget.remaining <= 0) return localPath;
      refreshBudget.remaining -= 1;
    }
    resolvedPath = versionedImagePath(localPath, remoteUrl);
    const versionedEntry = manifest[resolvedPath];
    if (versionedEntry?.remoteUrl === remoteUrl) {
      await fs.access(destination());
      if (!isTmdbFresh(versionedEntry.fetchedAt)) {
        if (refreshBudget.remaining <= 0) return resolvedPath;
        refreshBudget.remaining -= 1;
        return await downloadImage(remoteUrl, root, resolvedPath, manifestPath, refreshBudget);
      }
      return resolvedPath;
    }
  } catch {
    // The image is missing and must be downloaded.
  }

  try {
    await fs.mkdir(path.dirname(destination()), { recursive: true });
    return await downloadImage(remoteUrl, root, resolvedPath, manifestPath, refreshBudget);
  } catch (error) {
    console.error(`[Image Cache] Failed for ${resolvedPath}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

async function downloadImage(remoteUrl: string, root: string, localPath: string, manifestPath: string, budget: ImageRefreshBudget): Promise<string> {
  const destination = path.join(root, localPath.replace(/^\//, ''));
  await fs.mkdir(path.dirname(destination), { recursive: true });
  budget.attempted += 1;
  const kind = localPath.startsWith('/images/posters/') ? 'posters' : localPath.startsWith('/images/backdrops/') ? 'backdrops' : 'people';
  budget.byType[kind].attempted += 1;
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
  if (!bytes) {
    budget.failed += 1;
    budget.byType[kind].failed += 1;
    budget.failureDetails.push({ localPath, message: lastError instanceof Error ? lastError.message : String(lastError || 'image download failed') });
    throw lastError || new Error('image download failed');
  }
  const temporaryPath = `${destination}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, bytes);
  await fs.rename(temporaryPath, destination);
  await recordManifestEntry(localPath, remoteUrl, new Date().toISOString(), manifestPath);
  budget.succeeded += 1;
  budget.byType[kind].succeeded += 1;
  return localPath;
}

export async function getImageCacheFreshnessStats(manifestPath = defaultManifestPath(), now: Date = new Date()): Promise<{
  freshImages: number;
  staleImages: number;
  legacyImages: number;
  oldestSuccessfulFetchAt?: string;
  byType: Record<'posters' | 'backdrops' | 'people', { total: number; fresh: number; stale: number; legacy: number; oldestSuccessfulFetchAt?: string }>;
}> {
  const manifest = await readManifest(manifestPath);
  const entries = Object.values(manifest);
  const dated = entries.map((entry) => entry.fetchedAt).filter((timestamp): timestamp is string => typeof timestamp === 'string' && Number.isFinite(Date.parse(timestamp)));
  const legacyImages = entries.length - entries.filter((entry) => entry.fetchedAt && Number.isFinite(Date.parse(entry.fetchedAt))).length;
  const freshImages = dated.filter((timestamp) => isTmdbFresh(timestamp, now)).length;
  const statsFor = (kind: 'posters' | 'backdrops' | 'people') => {
    const kindEntries = Object.entries(manifest)
      .filter(([localPath]) => localPath.startsWith(`/images/${kind}/`))
      .map(([, entry]) => entry);
    const legacy = kindEntries.filter((entry) => !entry.fetchedAt || !Number.isFinite(Date.parse(entry.fetchedAt))).length;
    const fresh = kindEntries.filter((entry) => isTmdbFresh(entry.fetchedAt, now)).length;
    const dated = kindEntries.map((entry) => entry.fetchedAt).filter((timestamp): timestamp is string => typeof timestamp === 'string' && Number.isFinite(Date.parse(timestamp)));
    return { total: kindEntries.length, fresh, stale: kindEntries.length - legacy - fresh, legacy, oldestSuccessfulFetchAt: dated.sort((left, right) => Date.parse(left) - Date.parse(right))[0] };
  };
  return {
    freshImages,
    staleImages: entries.length - legacyImages - freshImages,
    legacyImages,
    oldestSuccessfulFetchAt: dated.sort((a, b) => Date.parse(a) - Date.parse(b))[0],
    byType: { posters: statsFor('posters'), backdrops: statsFor('backdrops'), people: statsFor('people') },
  };
}
