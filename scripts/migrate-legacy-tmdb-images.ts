import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MOVIES } from '../src/data/movies';
import { parseMoviesModule, generateMoviesModule } from '../src/server/movie-import';
import { createR2Storage, type R2Storage } from '../src/server/r2-storage';
import { buildImageMagickCommand, requireImageMagickExecutable } from '../src/server/image-processing';
import { writeFileAtomically } from '../src/utils/atomic-file';
import type { Actor, Movie } from '../src/types';

type ImageKind = 'poster' | 'backdrop' | 'person';
type MigrationStatus = 'pending' | 'migrated' | 'failed' | 'verified-existing';

interface MigrationEntry {
  kind: ImageKind;
  sourceUrl: string;
  tmdbId: number;
  targetCanonicalPath: string;
  targetObjectKey: string;
  r2Exists: boolean;
  status: MigrationStatus;
  error?: string;
}

interface MigrationManifest {
  schemaVersion: 1;
  generatedAt: string;
  completedAt?: string;
  entries: MigrationEntry[];
}

const projectRoot = process.cwd();
const actorsPath = path.join(projectRoot, 'src/data/actors.json');
const moviesPath = path.join(projectRoot, 'src/data/movies.ts');
const manifestPath = path.join(projectRoot, 'data/legacy-tmdb-image-migration.json');
const directTmdbImage = /^https:\/\/image\.tmdb\.org\/t\/p\/(?:w500|w1280)\//;

function targetFor(kind: ImageKind, tmdbId: number): { canonicalPath: string; objectKey: string; extension: string } {
  if (kind === 'person') return { canonicalPath: `/images/people/${tmdbId}.webp`, objectKey: `people/${tmdbId}.webp`, extension: 'webp' };
  const directory = kind === 'poster' ? 'posters' : 'backdrops';
  return { canonicalPath: `/images/${directory}/${tmdbId}.jpg`, objectKey: `${directory}/${tmdbId}.jpg`, extension: 'jpg' };
}

function requireTmdbId(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) throw new Error(`Missing valid TMDB ID for ${label}.`);
  return Number(value);
}

function addEntry(entries: Map<string, MigrationEntry>, kind: ImageKind, sourceUrl: unknown, tmdbIdValue: unknown, label: string): void {
  if (typeof sourceUrl !== 'string' || !directTmdbImage.test(sourceUrl)) return;
  const tmdbId = requireTmdbId(tmdbIdValue, label);
  const target = targetFor(kind, tmdbId);
  const key = `${kind}:${tmdbId}`;
  const existing = entries.get(key);
  if (existing) return;
  entries.set(key, {
    kind,
    sourceUrl,
    tmdbId,
    targetCanonicalPath: target.canonicalPath,
    targetObjectKey: target.objectKey,
    r2Exists: false,
    status: 'pending',
  });
}

function deriveEntries(movies: Movie[], actors: Actor[]): MigrationEntry[] {
  const entries = new Map<string, MigrationEntry>();
  for (const movie of movies) {
    const tmdbId = requireTmdbId(movie.tmdbId, movie.title);
    addEntry(entries, 'poster', movie.posterUrl, tmdbId, `movie ${movie.title}`);
    addEntry(entries, 'backdrop', movie.backdropUrl, tmdbId, `movie ${movie.title}`);
    for (const member of [...(movie.cast || []), ...(movie.crew || [])]) {
      const personId = 'tmdbPersonId' in member ? member.tmdbPersonId : 'id' in member ? member.id : undefined;
      addEntry(entries, 'person', member.profileUrl, personId, `${movie.title}/${member.name}`);
    }
  }
  for (const actor of actors) {
    addEntry(entries, 'person', actor.profileUrl, actor.tmdbPersonId, actor.name);
    addEntry(entries, 'person', actor.photoUrl, actor.tmdbPersonId, actor.name);
  }
  return [...entries.values()].sort((left, right) => left.targetObjectKey.localeCompare(right.targetObjectKey));
}

async function readManifest(): Promise<MigrationManifest> {
  try {
    return JSON.parse(await fs.readFile(manifestPath, 'utf8')) as MigrationManifest;
  } catch {
    return { schemaVersion: 1, generatedAt: new Date().toISOString(), entries: [] };
  }
}

async function writeManifest(manifest: MigrationManifest): Promise<void> {
  await writeFileAtomically(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function imageFormat(filePath: string): string {
  const command = buildImageMagickCommand(requireImageMagickExecutable(), 'identify', ['-format', '%m', filePath]);
  return execFileSync(command.executable, command.args, { encoding: 'utf8' }).trim().toUpperCase();
}

async function downloadAndConvert(entry: MigrationEntry, directory: string): Promise<{ bytes: Buffer; contentType: string }> {
  const sourcePath = path.join(directory, `${entry.kind}-${entry.tmdbId}-source`);
  const outputPath = path.join(directory, `${entry.kind}-${entry.tmdbId}.${entry.kind === 'person' ? 'webp' : 'jpg'}`);
  const response = await fetch(entry.sourceUrl, { signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`TMDB source returned HTTP ${response.status}.`);
  const sourceBytes = Buffer.from(await response.arrayBuffer());
  if (sourceBytes.length === 0) throw new Error('TMDB source returned an empty body.');
  await fs.writeFile(sourcePath, sourceBytes);
  if (!['JPEG', 'PNG', 'WEBP', 'AVIF'].includes(imageFormat(sourcePath))) throw new Error('TMDB source is not a supported image.');

  const outputFormat = entry.kind === 'person' ? 'webp' : 'jpeg';
  const command = buildImageMagickCommand(requireImageMagickExecutable(), 'convert', [sourcePath, '-auto-orient', '-strip', '-quality', entry.kind === 'person' ? '82' : '90', `${outputFormat}:${outputPath}`]);
  execFileSync(command.executable, command.args, { stdio: 'ignore' });
  const expectedFormat = entry.kind === 'person' ? 'WEBP' : 'JPEG';
  if (imageFormat(outputPath) !== expectedFormat) throw new Error(`Image conversion did not produce ${expectedFormat}.`);
  return { bytes: await fs.readFile(outputPath), contentType: entry.kind === 'person' ? 'image/webp' : 'image/jpeg' };
}

async function migrateEntry(entry: MigrationEntry, storage: R2Storage, tempDirectory: string): Promise<void> {
  const existing = await storage.headObject(entry.targetObjectKey);
  entry.r2Exists = Boolean(existing);
  if (existing) {
    if (existing.size <= 0) throw new Error('Existing R2 object is empty.');
    entry.status = 'verified-existing';
    return;
  }
  const processed = await downloadAndConvert(entry, tempDirectory);
  const result = await storage.ensureUploadedAndVerified(entry.targetObjectKey, processed.bytes, processed.contentType);
  if (!result.verified) throw new Error('R2 publication was not verified.');
  const localPath = path.join(projectRoot, 'public', entry.targetCanonicalPath.slice(1));
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  await fs.writeFile(localPath, processed.bytes);
  entry.status = existing ? 'verified-existing' : 'migrated';
}

function applyCanonicalUpdates(movies: Movie[], actors: Actor[], entries: MigrationEntry[]): { movies: Movie[]; actors: Actor[] } {
  const successful = new Map(entries.filter((entry) => entry.status === 'migrated' || entry.status === 'verified-existing').map((entry) => [`${entry.kind}:${entry.tmdbId}`, entry.targetCanonicalPath]));
  const nextMovies = movies.map((movie) => {
    const poster = successful.get(`poster:${movie.tmdbId}`);
    const backdrop = successful.get(`backdrop:${movie.tmdbId}`);
    const updatePerson = <T extends { profileUrl?: string; tmdbPersonId?: number; id?: number }>(member: T): T => {
      const personId = member.tmdbPersonId ?? member.id;
      return personId && successful.has(`person:${personId}`) && directTmdbImage.test(member.profileUrl || '')
        ? { ...member, profileUrl: successful.get(`person:${personId}`) } as T
        : member;
    };
    return {
      ...movie,
      posterUrl: poster && directTmdbImage.test(movie.posterUrl) ? poster : movie.posterUrl,
      backdropUrl: backdrop && directTmdbImage.test(movie.backdropUrl || '') ? backdrop : movie.backdropUrl,
      cast: movie.cast.map(updatePerson),
      crew: movie.crew?.map(updatePerson),
    };
  });
  const nextActors = actors.map((actor) => {
    const target = successful.get(`person:${actor.tmdbPersonId}`);
    return target && (directTmdbImage.test(actor.profileUrl || '') || directTmdbImage.test(actor.photoUrl || ''))
      ? { ...actor, profileUrl: directTmdbImage.test(actor.profileUrl || '') ? target : actor.profileUrl, photoUrl: directTmdbImage.test(actor.photoUrl || '') ? target : actor.photoUrl }
      : actor;
  });
  return { movies: nextMovies, actors: nextActors };
}

async function main(): Promise<void> {
  const sourceMovies = parseMoviesModule(await fs.readFile(moviesPath, 'utf8'), moviesPath);
  const sourceActors = JSON.parse(await fs.readFile(actorsPath, 'utf8')) as Actor[];
  const entries = deriveEntries(sourceMovies, sourceActors);
  const manifest: MigrationManifest = { schemaVersion: 1, generatedAt: new Date().toISOString(), entries };
  await writeManifest(manifest);
  console.log(`Derived migration manifest: ${entries.length} unique targets (${manifestPath}).`);

  const storage = createR2Storage();
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'xmasdb-legacy-tmdb-images-'));
  try {
    for (const entry of entries) {
      try {
        await migrateEntry(entry, storage, tempDirectory);
        console.log(`${entry.status}: ${entry.targetObjectKey}`);
      } catch (error) {
        entry.status = 'failed';
        entry.error = error instanceof Error ? error.message : String(error);
        console.error(`failed: ${entry.targetObjectKey}: ${entry.error}`);
      }
      await writeManifest({ ...manifest, completedAt: new Date().toISOString() });
    }
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }

  const updated = applyCanonicalUpdates(sourceMovies, sourceActors, entries);
  await writeFileAtomically(moviesPath, generateMoviesModule(updated.movies));
  await writeFileAtomically(actorsPath, `${JSON.stringify(updated.actors, null, 2)}\n`);
  await writeManifest({ ...manifest, completedAt: new Date().toISOString() });

  const summary = {
    posters: entries.filter((entry) => entry.kind === 'poster'),
    backdrops: entries.filter((entry) => entry.kind === 'backdrop'),
    people: entries.filter((entry) => entry.kind === 'person'),
  };
  console.log(`Migration complete: posters=${summary.posters.filter((entry) => entry.status !== 'failed').length}/${summary.posters.length}, backdrops=${summary.backdrops.filter((entry) => entry.status !== 'failed').length}/${summary.backdrops.length}, people=${summary.people.filter((entry) => entry.status !== 'failed').length}/${summary.people.length}, failed=${entries.filter((entry) => entry.status === 'failed').length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
