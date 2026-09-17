/**
 * Hallmark Countdown to Christmas Scraper & TMDB Matcher
 * 
 * Extracts candidate titles from Hallmark's official preview pages:
 * https://www.hallmarkchannel.com/christmas/countdown-to-christmas-YEAR-preview/
 * 
 * Evaluates candidates, detects possible TV/reality series, and queries TMDB
 * to retrieve candidate metadata for manual user approval.
 */

import https from 'https';
import http from 'http';
import { getMovies } from './movie-storage.js';

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "’")
    .replace(/&lsquo;/g, "‘")
    .replace(/&rdquo;/g, "”")
    .replace(/&ldquo;/g, "“")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes title for loose comparison and candidate ranking
 * Handles ampersands, punctuation, whitespace collapsing
 */
export function normalizeTitle(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’'""`]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Downloads Hallmark News HTML page
 */
export async function fetchHallmarkNewsHtml() {
  const url = 'https://www.hallmarkchannel.com/christmas/countdown-to-christmas-movie-news';
  
  return new Promise((resolve, reject) => {
    const requestOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    };

    const makeRequest = (currentUrl, redirectCount = 0) => {
      if (redirectCount > 5) {
        return reject(new Error('Too many redirects when fetching Hallmark news.'));
      }

      const client = currentUrl.startsWith('https') ? https : http;
      client.get(currentUrl, requestOptions, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, currentUrl).toString();
          return makeRequest(redirectUrl, redirectCount + 1);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`Hallmark returned HTTP ${res.statusCode} ${res.statusText || ''}`));
        }

        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve(body));
      }).on('error', err => reject(err));
    };

    makeRequest(url);
  });
}

/**
 * Extracts announced movie candidates from Hallmark's Countdown to Christmas News page
 */
export function extractHallmarkNewsCandidates(rawHtml) {
  const candidates = [];
  const seen = new Set();
  const newsUrl = 'https://www.hallmarkchannel.com/christmas/countdown-to-christmas-movie-news';

  // Strip script and style blocks to prevent false positive matches
  const html = rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  function cleanCandidateTitle(raw) {
    if (!raw) return '';
    return raw
      .replace(/^(First Look|Sneak Peek|Exclusive Preview|Preview|Teaser)\s*[-:–—]\s*/i, '')
      .replace(/\s*[-:–—|]\s*(Coming This Countdown to Christmas.*|Coming to Hallmark.*|This Countdown to Christmas.*)$/i, '')
      .replace(/["“”]/g, '')
      .replace(/[,;]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function addCandidate(rawTitle, desc, date, premiere) {
    const clean = cleanCandidateTitle(rawTitle);
    if (!clean || clean.length < 3) return;
    const lower = clean.toLowerCase();
    if (seen.has(lower)) return;
    if (/^(countdown to christmas|hallmark channel|hallmark|movies|movies & series news|watch now|false|true|details to come)$/i.test(clean)) return;

    seen.add(lower);

    // Check for possible episodic series strictly from Hallmark source metadata/notes, never from title keywords
    const isSeriesBody = /(\bcompetition series\b|\breality competition\b|\bholiday reality series\b|\bweekly series\b|\bdocuseries\b)/i.test(desc || '');

    candidates.push({
      hallmarkTitle: clean,
      description: desc ? decodeHtmlEntities(desc) : '',
      announcementDate: date || 'Hallmark News Announcement',
      premiereDate: premiere || null,
      pageUrl: newsUrl,
      possibleSeries: isSeriesBody,
      seriesReason: isSeriesBody ? 'Hallmark source notes indicate competition/weekly series' : null
    });
  }

  // 1. Check video preview objects
  const videoObjs = [...rawHtml.matchAll(/data-video-obj="([^"]+)"/g)];
  for (const m of videoObjs) {
    try {
      const decoded = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
      const parsed = JSON.parse(decoded);
      addCandidate(parsed.title, parsed.blurb, 'Hallmark Video Preview', null);
    } catch {}
  }

  // 2. Check quoted movie titles in editorial paragraphs
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pMatch;
  while ((pMatch = pRegex.exec(html)) !== null) {
    const pText = pMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const titleRegex = /["“]([A-Za-z0-9\s:,'’&!-]+?)["”]/g;
    let tMatch;
    while ((tMatch = titleRegex.exec(pText)) !== null) {
      const candidateTitle = tMatch[1].trim();
      if (candidateTitle.length > 3 && !candidateTitle.toLowerCase().includes('countdown to christmas') && !candidateTitle.toLowerCase().includes('hallmark')) {
        const premiereMatch = pText.match(/(?:premieres?|on)\s+((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:\s+at\s+[\d\/a-z]+)?)/i);
        addCandidate(candidateTitle, pText, 'Hallmark News Announcement', premiereMatch ? premiereMatch[1].trim() : null);
      }
    }
  }

  return candidates;
}

/**
 * Downloads Hallmark HTML page
 */
export async function fetchHallmarkHtml(year) {
  const url = `https://www.hallmarkchannel.com/christmas/countdown-to-christmas-${year}-preview/`;
  
  return new Promise((resolve, reject) => {
    const requestOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    };

    const makeRequest = (currentUrl, redirectCount = 0) => {
      if (redirectCount > 5) {
        return reject(new Error('Too many redirects when fetching Hallmark page.'));
      }

      const client = currentUrl.startsWith('https') ? https : http;
      client.get(currentUrl, requestOptions, (res) => {
        // Follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, currentUrl).toString();
          return makeRequest(redirectUrl, redirectCount + 1);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`Hallmark returned HTTP ${res.statusCode} ${res.statusText || ''}`));
        }

        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve(body));
      }).on('error', err => reject(err));
    };

    makeRequest(url);
  });
}

/**
 * Extracts titles from Hallmark listicle HTML and identifies potential series
 */
export function extractHallmarkCandidates(html, targetYear) {
  const candidates = [];
  const seenTitles = new Set();

  // Split into slide blocks
  const slides = html.split(/<div class="ListiclePage-slide"/i);

  // If slide blocks exist
  if (slides.length > 1) {
    for (let i = 1; i < slides.length; i++) {
      const slide = slides[i];
      let title = '';

      // Pattern 1: data-info-title="Title"
      const m1 = slide.match(/data-info-title="([^"]+)"/i);
      if (m1) title = m1[1];

      // Pattern 2: class="ListicleSlide-title"
      if (!title) {
        const m2 = slide.match(/class="ListicleSlide-title"[^>]*>(.*?)<\/div>/i);
        if (m2) title = m2[1].replace(/<[^>]+>/g, '');
      }

      // Pattern 3: <figure ...> ... alt="Title"
      if (!title) {
        const m3 = slide.match(/<figure[^>]*>[\s\S]*?<img[^>]*alt="([^"]+)"/i);
        if (m3 && !m3[1].toLowerCase().includes('hallmark') && !m3[1].toLowerCase().includes('countdown')) {
          title = m3[1];
        }
      }

      // Pattern 4: <p><b><a class="Link" ...>Title</a>
      if (!title) {
        const m4 = slide.match(/<p>\s*<b>\s*<a class="Link"[^>]*>(.*?)<\/a>/i);
        if (m4) title = m4[1].replace(/<[^>]+>/g, '');
      }

      const cleanTitle = decodeHtmlEntities(title);
      if (!cleanTitle || seenTitles.has(cleanTitle.toLowerCase())) continue;
      seenTitles.add(cleanTitle.toLowerCase());

      // Only mark POSSIBLE SERIES when the Hallmark source itself identifies the programme as a series/episodic programme.
      // Do NOT guess from title keywords (such as "Season", "Christmas", "Holiday", "Episode", "Part", "Chapter").
      const isSeriesBody = /(\bcontinue each week\b|\bcontinues each week\b|\bepisodes continue\b|\bcompetition series\b|\breality competition\b|\bholiday competition\b)/i.test(slide);
      
      const possibleSeries = isSeriesBody;
      let seriesReason = null;
      if (possibleSeries) {
        if (/continue each week|continues each week|episodes continue/i.test(slide)) {
          seriesReason = 'Hallmark schedule indicates weekly episodic broadcast';
        } else if (/competition/i.test(slide)) {
          seriesReason = 'Hallmark description indicates a reality/competition program';
        } else {
          seriesReason = 'Hallmark source notes indicate series or competition';
        }
      }

      candidates.push({
        hallmarkTitle: cleanTitle,
        possibleSeries,
        seriesReason,
        year: targetYear
      });
    }
  }

  // Fallback: search for any header links or carousel items if listicle slides weren't split
  if (candidates.length === 0) {
    const titleAttrMatches = [...html.matchAll(/data-info-title="([^"]+)"/gi)];
    for (const match of titleAttrMatches) {
      const cleanTitle = decodeHtmlEntities(match[1]);
      if (cleanTitle && !seenTitles.has(cleanTitle.toLowerCase())) {
        seenTitles.add(cleanTitle.toLowerCase());
        candidates.push({
          hallmarkTitle: cleanTitle,
          possibleSeries: false,
          seriesReason: null,
          year: targetYear
        });
      }
    }
  }

  return candidates;
}

/**
 * Return a TMDB match only when title and release year both agree exactly.
 * Ambiguous matches are intentionally rejected rather than guessed.
 */
export async function matchCandidateWithTmdb(candidate, year, fetchFromTmdb, token = '') {
  if (!candidate || candidate.possibleSeries || !candidate.hallmarkTitle) return null;

  const normalize = value => normalizeTitle(String(value || ''));
  const expectedTitle = normalize(candidate.hallmarkTitle);
  const result = await fetchFromTmdb('search/movie', {
    query: candidate.hallmarkTitle,
    include_adult: 'false'
  }, token);

  const exactMatches = (result.data?.results || []).filter(movie => {
    const releaseYear = movie.release_date ? parseInt(movie.release_date.slice(0, 4), 10) : null;
    const titleMatches = normalize(movie.title) === expectedTitle || normalize(movie.original_title) === expectedTitle;
    return titleMatches && releaseYear === Number(year);
  });

  const uniqueMatches = [...new Map(exactMatches.map(movie => [movie.id, movie])).values()];
  if (uniqueMatches.length !== 1) return null;

  const movie = uniqueMatches[0];
  return {
    ...candidate,
    tmdbId: movie.id,
    tmdbTitle: movie.title,
    tmdbYear: Number(year),
    tmdbResults: [{
      id: movie.id,
      tmdbId: movie.id,
      title: movie.title,
      year: Number(year),
      release_date: movie.release_date || '',
      overview: movie.overview || '',
      poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
      imdb_id: null
    }],
    confidence: 'exact-title-and-year'
  };
}
