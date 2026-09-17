import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const IMAGE_DIRS = { poster: 'posters', person: 'people' };
const IMAGE_WIDTHS = { poster: 900, person: 800 };

function imageId(id) {
  const value = Number(id);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`Invalid TMDB image ID: ${id}`);
  return value;
}

export function localImagePath(kind, id) {
  return `/images/${IMAGE_DIRS[kind]}/${imageId(id)}.webp`;
}

export function sourceImagePath(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const clean = value.trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    const match = clean.match(/image\.tmdb\.org\/t\/p\/[^/]+(\/[^?#]+)$/);
    return match ? match[1] : null;
  }
  if (clean.startsWith('/images/')) return null;
  return clean.startsWith('/') ? clean : `/${clean}`;
}

function assetFiles(rootDir, kind, id) {
  const relative = localImagePath(kind, id).slice(1);
  return [path.join(rootDir, relative), path.join(rootDir, 'public', relative)];
}

async function validWebp(file) {
  try {
    const metadata = await sharp(file).metadata();
    return metadata.format === 'webp' && metadata.width > 0 && metadata.height > 0;
  } catch {
    return false;
  }
}

async function copyToPublic(rootFile, publicFile) {
  await fs.promises.mkdir(path.dirname(publicFile), { recursive: true });
  await fs.promises.copyFile(rootFile, publicFile);
}

export async function cacheTmdbImage({ kind, id, filePath, rootDir, force = false }) {
  const numericId = imageId(id);
  const [rootFile, publicFile] = assetFiles(rootDir, kind, numericId);
  const existingRoot = await validWebp(rootFile);
  const existingPublic = await validWebp(publicFile);
  if (!force && existingRoot) {
    if (!existingPublic) await copyToPublic(rootFile, publicFile);
    return { status: 'cached', path: localImagePath(kind, numericId) };
  }
  if (!filePath) return { status: 'missing', path: existingRoot ? localImagePath(kind, numericId) : null };

  const source = sourceImagePath(filePath);
  if (!source) return { status: 'missing', path: existingRoot ? localImagePath(kind, numericId) : null };
  const response = await fetch(`${IMAGE_BASE_URL}/original${source}`, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Image ${numericId}: HTTP ${response.status}`);
  const input = Buffer.from(await response.arrayBuffer());
  const output = await sharp(input)
    .rotate()
    .resize({ width: IMAGE_WIDTHS[kind], withoutEnlargement: true })
    .webp({ quality: 88, effort: 4 })
    .toBuffer();
  const temp = `${rootFile}.${process.pid}.${Date.now()}.tmp`;
  await fs.promises.mkdir(path.dirname(rootFile), { recursive: true });
  await fs.promises.writeFile(temp, output);
  if (!(await validWebp(temp))) {
    await fs.promises.rm(temp, { force: true });
    throw new Error(`Image ${numericId}: generated WebP failed validation`);
  }
  await fs.promises.rename(temp, rootFile);
  await copyToPublic(rootFile, publicFile);
  return { status: 'downloaded', path: localImagePath(kind, numericId) };
}

export async function ensureCachedImage(options) {
  try {
    return await cacheTmdbImage(options);
  } catch (error) {
    return { status: 'failed', path: null, error };
  }
}
