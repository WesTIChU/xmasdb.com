import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildCatalogueMeta } from './catalogue-api';
import { writeFileAtomically } from '../utils/atomic-file';

export type ContactSubmissionType = 'missing-movie' | 'correction' | 'other';

export interface ContactSubmissionInput {
  type: unknown;
  title: unknown;
  message: unknown;
  name: unknown;
  email: unknown;
  spamCheck: unknown;
  website: unknown;
}

export interface StoredContactSubmission {
  id: string;
  createdAt: string;
  status: 'new' | 'resolved';
  type: ContactSubmissionType;
  movieTitle: string;
  message: string;
  name?: string;
  email?: string;
}

export interface ContactValidationSuccess {
  ok: true;
  submission: StoredContactSubmission;
}

export interface ContactValidationFailure {
  ok: false;
  code: 'invalid' | 'honeypot';
  message?: string;
}

export type ContactValidationResult = ContactValidationSuccess | ContactValidationFailure;

export const CONTACT_RATE_LIMIT = 5;
export const CONTACT_RATE_WINDOW_MS = 15 * 60 * 1000;

const MAX_LENGTHS = {
  name: 100,
  email: 254,
  title: 200,
  message: 3000,
} as const;

function textValue(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

function invalid(message: string): ContactValidationFailure {
  return { ok: false, code: 'invalid', message };
}

export function getContactDataDir(): string {
  return process.env.XMASDB_DATA_DIR?.trim() || path.resolve(process.cwd(), 'data');
}

export function getContactSubmissionsPath(dataDir = getContactDataDir()): string {
  return path.join(dataDir, 'contact-submissions.json');
}

/** Validates untrusted form data against the current canonical catalogue count. */
export function validateContactSubmission(input: unknown): ContactValidationResult {
  if (!input || typeof input !== 'object') return invalid('Please complete the form and try again.');
  const values = input as Record<string, unknown>;
  if (textValue(values.website)) return { ok: false, code: 'honeypot' };

  const type = textValue(values.type);
  const title = textValue(values.title);
  const message = textValue(values.message);
  const name = textValue(values.name);
  const email = textValue(values.email);
  const spamCheck = textValue(values.spamCheck);

  if (!type || !['missing-movie', 'correction', 'other'].includes(type)) {
    return invalid('Choose what you would like to report.');
  }
  if ((type === 'missing-movie' || type === 'correction') && !title) {
    return invalid('Please add the movie or title.');
  }
  if (!message) return invalid('Please add a message.');
  if (!spamCheck || spamCheck !== String(buildCatalogueMeta().totalMovies)) {
    return invalid("That movie count doesn't look right. Check the number at the top of the page and try again.");
  }
  if (title && title.length > MAX_LENGTHS.title) return invalid('Movie or title is too long.');
  if (message.length > MAX_LENGTHS.message) return invalid('Message is too long.');
  if (name && name.length > MAX_LENGTHS.name) return invalid('Name is too long.');
  if (email && email.length > MAX_LENGTHS.email) return invalid('Email address is too long.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return invalid('Enter a valid email address or leave it blank.');

  return {
    ok: true,
    submission: {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'new',
      type: type as ContactSubmissionType,
      movieTitle: title || '',
      message,
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
    },
  };
}

export class ContactRateLimiter {
  private readonly attempts = new Map<string, number[]>();

  allow(ip: string, now = Date.now()): boolean {
    const recent = (this.attempts.get(ip) || []).filter((timestamp) => now - timestamp < CONTACT_RATE_WINDOW_MS);
    if (recent.length >= CONTACT_RATE_LIMIT) {
      this.attempts.set(ip, recent);
      return false;
    }
    recent.push(now);
    this.attempts.set(ip, recent);
    return true;
  }
}

let writeQueue = Promise.resolve();

async function readStoredSubmissions(filePath: string): Promise<StoredContactSubmission[]> {
  try {
    const existing = await fs.readFile(filePath, 'utf8');
    const parsed: unknown = JSON.parse(existing);
    if (!Array.isArray(parsed)) throw new Error('Contact submissions JSON must contain an array.');
    return parsed as StoredContactSubmission[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export function readContactSubmissions(dataDir = getContactDataDir()): Promise<StoredContactSubmission[]> {
  return readStoredSubmissions(getContactSubmissionsPath(dataDir));
}

/** Creates the runtime store without replacing an existing malformed file. */
export async function ensureContactStorage(dataDir = getContactDataDir()): Promise<void> {
  const filePath = getContactSubmissionsPath(dataDir);
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await readStoredSubmissions(filePath);
  } catch (error) {
    console.error('Contact submissions file is malformed; preserving it for recovery.', error instanceof Error ? error.message : 'invalid JSON');
    return;
  }
  try {
    await fs.access(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await writeFileAtomically(filePath, '[]\n');
  }
}

/** Updates the canonical store using serialized, same-directory atomic replacement. */
export function updateContactSubmissions(
  updater: (submissions: StoredContactSubmission[]) => StoredContactSubmission[],
  dataDir = getContactDataDir(),
): Promise<StoredContactSubmission[]> {
  const filePath = getContactSubmissionsPath(dataDir);
  const operation = writeQueue.then(async () => {
    await fs.mkdir(dataDir, { recursive: true });
    const submissions = await readStoredSubmissions(filePath);
    const updated = updater(submissions);
    await writeFileAtomically(filePath, JSON.stringify(updated, null, 2) + '\n');
    return updated;
  });
  writeQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export function storeContactSubmission(submission: StoredContactSubmission, dataDir = getContactDataDir()): Promise<StoredContactSubmission[]> {
  return updateContactSubmissions((submissions) => [...submissions, submission], dataDir);
}
