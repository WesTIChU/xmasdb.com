import type { Movie } from '../types';
import { getBrandById } from '../data/brands';
import { getMoviePath, toCanonicalUrl } from '../utils/urls';

const FLARUM_DISCUSSIONS_URL = 'https://community.xmasdb.com/api/discussions';
const XMASDB_UPDATES_TAG_ID = '13';
const NETWORK_TAG_IDS: Record<string, string> = {
  hallmark: '6',
  lifetime: '7',
  gaf: '8',
  uptv: '9',
};

interface FlarumDiscussionPayload {
  data: {
    type: 'discussions';
    attributes: {
      title: string;
      content: string;
    };
    relationships: {
      tags: {
        data: Array<{ type: 'tags'; id: string }>;
      };
    };
  };
}

function getDiscussionTags(movie: Movie): Array<{ type: 'tags'; id: string }> {
  const tags = [{ type: 'tags' as const, id: XMASDB_UPDATES_TAG_ID }];
  const secondaryTagId = NETWORK_TAG_IDS[getBrandById(movie.brandId)?.id || ''];
  if (secondaryTagId) tags.push({ type: 'tags', id: secondaryTagId });
  return tags;
}

export function buildFlarumDiscussionPayload(movie: Movie): FlarumDiscussionPayload {
  const brand = getBrandById(movie.brandId);
  const actorNames = [...new Set(movie.cast.map((member) => member.name.trim()).filter(Boolean))];
  const details = [
    brand?.shortName ? `Network: ${brand.shortName}` : '',
    movie.year ? `Year: ${movie.year}` : '',
    actorNames.length ? `Starring: ${actorNames.join(', ')}` : '',
  ].filter(Boolean);
  const movieUrl = toCanonicalUrl(getMoviePath(movie.tmdbId, movie.slug));

  return {
    data: {
      type: 'discussions',
      attributes: {
        title: `🎄 New on XmasDB: ${movie.title} (${movie.year})`,
        content: [
          `${movie.title} has just been added to XmasDB! 🎬`,
          '',
          ...details,
          '',
          'View on XmasDB:',
          movieUrl,
          '',
          '🤖 Posted automatically by XmasDB Bot.',
        ].join('\n'),
      },
      relationships: {
        tags: { data: getDiscussionTags(movie) },
      },
    },
  };
}

export interface FlarumNotifierOptions {
  token?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

/** Sends a best-effort announcement without allowing community availability to affect catalogue writes. */
export async function notifyFlarumMovieAdded(movie: Movie, options: FlarumNotifierOptions = {}): Promise<void> {
  const token = options.token ?? process.env.FLARUM_API_TOKEN;
  if (!token) {
    console.warn('[Flarum] FLARUM_API_TOKEN is not configured; skipping movie announcement.');
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  try {
    const response = await (options.fetcher ?? fetch)(FLARUM_DISCUSSIONS_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Token ${token}`,
      },
      body: JSON.stringify(buildFlarumDiscussionPayload(movie)),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn('[Flarum] Movie announcement was rejected', JSON.stringify({ status: response.status, movie: movie.title }));
    }
  } catch (error) {
    console.warn('[Flarum] Movie announcement failed', JSON.stringify({ movie: movie.title, error: error instanceof Error ? error.message : 'request failed' }));
  } finally {
    clearTimeout(timeout);
  }
}
