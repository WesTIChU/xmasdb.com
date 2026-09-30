import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { contentTypeForImagePath, createR2Storage } from '../src/server/r2-storage';

const projectRoot = process.cwd();
const publicRoot = path.join(projectRoot, 'public');
const inventoryPath = path.join(projectRoot, 'reports', 'r2-image-inventory.json');
const migrationRoots = [
  'images/posters',
  'images/backdrops',
  'images/people',
  'images/optimized/posters',
  'images/optimized/people',
] as const;
const r2KeyPrefixes: Record<(typeof migrationRoots)[number], string> = {
  'images/posters': 'posters',
  'images/backdrops': 'backdrops',
  'images/people': 'people',
  'images/optimized/posters': 'optimized/posters',
  'images/optimized/people': 'optimized/people',
};
const preExistingMissingPersonFiles = [
  '/images/people/1883215.webp',
  '/images/people/2129919.webp',
  '/images/people/3739138.webp',
] as const;

export interface ImageInventoryEntry {
  objectKey: string;
  sourceLocalPath: string;
  byteSize: number;
  md5: string;
  sha256: string;
  contentType: string;
}

export interface ImageInventory {
  schemaVersion: 1;
  generatedAt: string;
  scope: string[];
  files: ImageInventoryEntry[];
  preExistingMissingPersonFiles: string[];
}

async function walk(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

async function hashFile(filePath: string): Promise<{ byteSize: number; md5: string; sha256: string }> {
  const bytes = await fs.readFile(filePath);
  return { byteSize: bytes.byteLength, md5: createHash('md5').update(bytes).digest('hex'), sha256: createHash('sha256').update(bytes).digest('hex') };
}

export async function buildInventory(): Promise<ImageInventory> {
  const files: ImageInventoryEntry[] = [];
  for (const relativeRoot of migrationRoots) {
    const absoluteRoot = path.join(publicRoot, relativeRoot);
    const localFiles = await walk(absoluteRoot);
    for (const localPath of localFiles) {
      const relativeToProject = path.relative(projectRoot, localPath).split(path.sep).join('/');
      const relativeToRoot = path.relative(absoluteRoot, localPath).split(path.sep).join('/');
      const objectKey = `${r2KeyPrefixes[relativeRoot]}/${relativeToRoot}`;
      const { byteSize, md5, sha256 } = await hashFile(localPath);
      files.push({ objectKey, sourceLocalPath: relativeToProject, byteSize, md5, sha256, contentType: contentTypeForImagePath(localPath) });
    }
  }
  files.sort((left, right) => left.objectKey.localeCompare(right.objectKey));
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scope: migrationRoots.map((root) => `public/${root}/`),
    files,
    preExistingMissingPersonFiles: [...preExistingMissingPersonFiles],
  };
}

async function writeInventory(output = inventoryPath): Promise<ImageInventory> {
  const inventory = await buildInventory();
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(inventory, null, 2)}\n`);
  console.log(`Inventory written: ${path.relative(projectRoot, output)}`);
  console.log(`Files: ${inventory.files.length}`);
  console.log(`Bytes: ${inventory.files.reduce((total, file) => total + file.byteSize, 0)}`);
  console.log(`Pre-existing missing person files: ${inventory.preExistingMissingPersonFiles.length}`);
  return inventory;
}

async function upload(inventory: ImageInventory, dryRun: boolean): Promise<void> {
  const storage = createR2Storage();
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  for (const file of inventory.files) {
    try {
      const bytes = await fs.readFile(path.join(projectRoot, file.sourceLocalPath));
      const existing = await storage.headObject(file.objectKey);
      const identical = existing && existing.size === file.byteSize && (existing.sha256 === file.sha256 || existing.etag === file.md5);
      if (identical) {
        skipped++;
        continue;
      }
      if (dryRun) {
        console.log(`Would upload ${file.objectKey}`);
        uploaded++;
        continue;
      }
      await storage.uploadAndVerify(file.objectKey, bytes, file.contentType);
      // The SHA-256 is sent as metadata so later verification can compare the exact source hash.
      // R2 accepts metadata on the PUT; this second request is deliberately avoided.
      uploaded++;
    } catch (error) {
      failed++;
      console.error(`Failed ${file.objectKey}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.log(`${dryRun ? 'Dry run' : 'Upload'} complete: uploaded=${uploaded} skipped=${skipped} failed=${failed}`);
  if (failed) throw new Error(`${failed} image upload(s) failed.`);
}

async function verify(inventory: ImageInventory): Promise<void> {
  const storage = createR2Storage();
  const remote = await storage.listObjects();
  const expectedKeys = new Set(inventory.files.map((file) => file.objectKey));
  const missing: string[] = [];
  const mismatches: string[] = [];
  for (const file of inventory.files) {
    const object = await storage.headObject(file.objectKey);
    if (!object) {
      missing.push(file.objectKey);
      continue;
    }
    if (object.size !== file.byteSize) mismatches.push(`${file.objectKey}: byte size ${object.size} != ${file.byteSize}`);
    if (object.contentType?.split(';')[0] !== file.contentType) mismatches.push(`${file.objectKey}: content type ${object.contentType || 'missing'} != ${file.contentType}`);
    if (object.sha256 && object.sha256 !== file.sha256) mismatches.push(`${file.objectKey}: SHA-256 metadata mismatch`);
    if (!object.sha256 && object.etag && /^[a-f0-9]{32}$/i.test(object.etag) && object.etag.toLowerCase() !== file.md5) mismatches.push(`${file.objectKey}: ETag checksum mismatch`);
  }
  const expectedPrefixes = Object.values(r2KeyPrefixes).map((prefix) => `${prefix}/`);
  const unexpected = remote.filter((object) => expectedPrefixes.some((prefix) => object.key.startsWith(prefix)) && !expectedKeys.has(object.key)).map((object) => object.key);
  console.log(`R2 objects: ${remote.length}; expected: ${inventory.files.length}; missing: ${missing.length}; mismatches: ${mismatches.length}; unexpected in scope: ${unexpected.length}`);
  if (missing.length) console.error(`Missing objects:\n${missing.join('\n')}`);
  if (mismatches.length) console.error(`Mismatches:\n${mismatches.join('\n')}`);
  if (unexpected.length) console.error(`Unexpected objects:\n${unexpected.join('\n')}`);

  const representatives = ['posters/1773345.jpg', 'backdrops/1773345.jpg', 'people/92856.webp', 'optimized/posters/974213-320.webp', 'optimized/people/92856-216.webp'];
  for (const key of representatives) {
    const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL?.trim() || 'https://images.xmasdb.com').replace(/\/$/, '');
    const url = `${publicBaseUrl}/${key}`;
    const response = await fetch(url, { method: 'HEAD' });
    const expected = inventory.files.find((file) => file.objectKey === key);
    const length = Number(response.headers.get('content-length') || 0);
    const contentType = response.headers.get('content-type')?.split(';')[0];
    console.log(`HTTP ${response.status} ${key} (${length} bytes, ${contentType || 'unknown'})`);
    if (!response.ok || !expected || length !== expected.byteSize || contentType !== expected.contentType) mismatches.push(`HTTP verification failed: ${key}`);
  }
  // Keep this lookup explicit so the list is also useful when R2 contains unrelated future objects.
  if (missing.length || mismatches.length || unexpected.length) throw new Error('R2 verification failed.');
}

function usage(): never {
  throw new Error('Usage: tsx scripts/r2-images.ts <inventory|upload|verify> [--dry-run] [--inventory path]');
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!command) usage();
  const outputIndex = process.argv.indexOf('--inventory');
  const selectedInventoryPath = outputIndex >= 0 ? path.resolve(process.argv[outputIndex + 1] || '') : inventoryPath;
  if (command === 'inventory') {
    await writeInventory(selectedInventoryPath);
    return;
  }
  const inventory = JSON.parse(await fs.readFile(selectedInventoryPath, 'utf8')) as ImageInventory;
  if (command === 'upload') {
    await upload(inventory, process.argv.includes('--dry-run'));
    return;
  }
  if (command === 'verify') {
    await verify(inventory);
    return;
  }
  usage();
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
