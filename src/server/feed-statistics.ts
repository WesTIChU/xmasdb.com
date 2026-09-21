import fs from 'node:fs/promises';
import path from 'node:path';
import { getContactDataDir } from './contact';
import { getActorByTmdbId } from '../data/actors';
import { BRANDS } from '../data/brands';
import type { FeedStatisticsPayload, FeedStatisticsType } from '../api/types';
import { writeFileAtomically } from '../utils/atomic-file';

export interface FeedDefinition {
  id: string;
  name: string;
  type: FeedStatisticsType;
}

interface StoredFeedStatistic extends FeedDefinition {
  totalPulls: number;
  dailyPulls: Record<string, number>;
  lastPulledAt?: string;
}

interface FeedStatisticsStore {
  version: 1;
  feeds: Record<string, StoredFeedStatistic>;
}

const FEED_STATISTICS_FILENAME = 'feed-statistics.json';
const RETAINED_DAYS = 30;
let writeQueue = Promise.resolve();

export function getFeedStatisticsPath(dataDir = getContactDataDir()): string {
  return path.join(dataDir, FEED_STATISTICS_FILENAME);
}

export function getKnownCollectionFeedDefinitions(): FeedDefinition[] {
  return [
    { id: 'collection:all', name: 'All Movies', type: 'collection' },
    ...BRANDS.map((brand) => ({ id: `collection:${brand.id}`, name: brand.shortName, type: 'collection' as const })),
  ];
}

export function getYearFeedDefinition(year: number): FeedDefinition {
  return { id: `year:${year}`, name: `Year ${year}`, type: 'year' };
}

export function getActorFeedDefinition(tmdbPersonId: number): FeedDefinition | undefined {
  const actor = getActorByTmdbId(tmdbPersonId);
  return actor
    ? { id: `actor:${tmdbPersonId}`, name: actor.name, type: 'actor' }
    : undefined;
}

export function getMetadataFeedDefinition(id: string, name: string): FeedDefinition {
  return { id: `metadata:${id}`, name, type: 'metadata' };
}

function emptyStore(): FeedStatisticsStore {
  return { version: 1, feeds: {} };
}

async function readStore(filePath: string): Promise<FeedStatisticsStore> {
  try {
    const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as Partial<FeedStatisticsStore>;
    if (parsed.version !== 1 || !parsed.feeds || typeof parsed.feeds !== 'object') throw new Error('Feed statistics JSON has an invalid shape.');
    return parsed as FeedStatisticsStore;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyStore();
    throw error;
  }
}

function ensureDefinition(store: FeedStatisticsStore, definition: FeedDefinition): StoredFeedStatistic {
  const existing = store.feeds[definition.id];
  if (existing) {
    existing.name = definition.name;
    existing.type = definition.type;
    existing.dailyPulls ||= {};
    return existing;
  }
  const created: StoredFeedStatistic = { ...definition, totalPulls: 0, dailyPulls: {} };
  store.feeds[definition.id] = created;
  return created;
}

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayDistance(day: string, now: Date): number {
  const timestamp = Date.parse(`${day}T00:00:00.000Z`);
  return Math.floor((Date.parse(`${utcDay(now)}T00:00:00.000Z`) - timestamp) / 86400000);
}

function pruneDailyPulls(statistic: StoredFeedStatistic, now: Date): void {
  for (const day of Object.keys(statistic.dailyPulls)) {
    if (dayDistance(day, now) >= RETAINED_DAYS) delete statistic.dailyPulls[day];
  }
}

function sumRecentPulls(statistic: StoredFeedStatistic, now: Date, days: number): number {
  return Object.entries(statistic.dailyPulls)
    .filter(([day]) => {
      const distance = dayDistance(day, now);
      return distance >= 0 && distance < days;
    })
    .reduce((total, [, count]) => total + count, 0);
}

function toPayload(store: FeedStatisticsStore, now: Date): FeedStatisticsPayload {
  const feeds = Object.values(store.feeds).map((statistic) => ({
    id: statistic.id,
    name: statistic.name,
    type: statistic.type,
    totalPulls: statistic.totalPulls,
    pullsToday: sumRecentPulls(statistic, now, 1),
    pullsLast7Days: sumRecentPulls(statistic, now, 7),
    pullsLast30Days: sumRecentPulls(statistic, now, 30),
    lastPulledAt: statistic.lastPulledAt,
  })).sort((left, right) => right.totalPulls - left.totalPulls || left.name.localeCompare(right.name));
  return {
    generatedAt: now.toISOString(),
    summary: {
      totalPulls: feeds.reduce((total, feed) => total + feed.totalPulls, 0),
      pullsToday: feeds.reduce((total, feed) => total + feed.pullsToday, 0),
      pullsLast7Days: feeds.reduce((total, feed) => total + feed.pullsLast7Days, 0),
      pullsLast30Days: feeds.reduce((total, feed) => total + feed.pullsLast30Days, 0),
    },
    feeds,
  };
}

export async function ensureFeedStatisticsStorage(dataDir = getContactDataDir()): Promise<void> {
  const filePath = getFeedStatisticsPath(dataDir);
  await fs.mkdir(dataDir, { recursive: true });
  try {
    const store = await readStore(filePath);
    for (const definition of getKnownCollectionFeedDefinitions()) ensureDefinition(store, definition);
    await writeFileAtomically(filePath, JSON.stringify(store, null, 2) + '\n');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      const store = emptyStore();
      for (const definition of getKnownCollectionFeedDefinitions()) ensureDefinition(store, definition);
      await writeFileAtomically(filePath, JSON.stringify(store, null, 2) + '\n');
      return;
    }
    console.error('Feed statistics file is malformed; preserving it for recovery.', error instanceof Error ? error.message : 'invalid JSON');
  }
}

export function recordFeedPull(definition: FeedDefinition, pulledAt = new Date(), dataDir = getContactDataDir()): Promise<void> {
  const operation = writeQueue.then(async () => {
    const filePath = getFeedStatisticsPath(dataDir);
    await fs.mkdir(dataDir, { recursive: true });
    const store = await readStore(filePath);
    const statistic = ensureDefinition(store, definition);
    pruneDailyPulls(statistic, pulledAt);
    const day = utcDay(pulledAt);
    statistic.dailyPulls[day] = (statistic.dailyPulls[day] || 0) + 1;
    statistic.totalPulls += 1;
    statistic.lastPulledAt = pulledAt.toISOString();
    await writeFileAtomically(filePath, JSON.stringify(store, null, 2) + '\n');
  });
  writeQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

export async function getFeedStatistics(now = new Date(), dataDir = getContactDataDir()): Promise<FeedStatisticsPayload> {
  const store = await readStore(getFeedStatisticsPath(dataDir));
  for (const definition of getKnownCollectionFeedDefinitions()) ensureDefinition(store, definition);
  for (const statistic of Object.values(store.feeds)) pruneDailyPulls(statistic, now);
  return toPayload(store, now);
}
