import type express from 'express';
import { configuredPublicImageBaseUrl } from '../utils/image-url';

const LEGACY_MANAGED_IMAGE_PATH = /^\/images\/(posters|backdrops|people|optimized\/posters|optimized\/people)\/(.+)$/;

/** Redirects removed, historically indexed local artwork URLs to their R2 objects. */
export function registerLegacyImageRedirects(app: express.Application): void {
  app.get('/images/*', (req, res, next) => {
    // Use the raw URL pathname so encoded characters in historical filenames are preserved.
    const pathname = new URL(req.originalUrl, 'http://localhost').pathname;
    const match = pathname.match(LEGACY_MANAGED_IMAGE_PATH);
    if (!match) return next();

    const destination = `${configuredPublicImageBaseUrl()}/${match[1]}/${match[2]}`;
    const search = new URL(req.originalUrl, 'http://localhost').search;
    return res.redirect(301, `${destination}${search}`);
  });
}
