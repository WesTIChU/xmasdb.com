import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCollectionMovie } from '../movie-storage.js';
import { selectTrailerVideos } from './trailer-utils.js';

test('new collection records retain the selected TMDB trailer through normalization', () => {
  const videos = selectTrailerVideos([
    { site: 'YouTube', key: 'clip', type: 'Clip', official: true },
    { site: 'YouTube', key: 'teaser', type: 'Teaser', official: true },
    { site: 'YouTube', key: 'IJWOTp9ta6c', type: 'Trailer', official: true }
  ]);
  const movie = normalizeCollectionMovie({
    title: 'Holiday Hearts',
    tmdbId: 638806,
    videos: videos.slice(0, 5)
  });

  assert.equal(videos[0].key, 'IJWOTp9ta6c');
  assert.deepEqual(movie.videos, videos);
});

test('trailer selection ignores unusable videos and prefers official trailers', () => {
  const selected = selectTrailerVideos([
    { site: 'Vimeo', key: 'wrong-site', type: 'Trailer', official: true },
    { site: 'YouTube', key: 'teaser', type: 'Teaser', official: true },
    { site: 'YouTube', key: 'unofficial', type: 'Trailer', official: false },
    { site: 'YouTube', key: 'official', type: 'Trailer', official: true }
  ]);

  assert.deepEqual(selected.map(video => video.key), ['official', 'unofficial', 'teaser']);
});
