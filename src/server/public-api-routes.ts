import type express from 'express';
import {
  buildPublicActorResponse,
  buildPublicActorsResponse,
  buildPublicIngredientResponse,
  buildPublicIngredientsResponse,
  buildPublicMoviesResponse,
} from './public-movies-api';

type SendJson = (res: express.Response, payload: unknown, status?: number) => void;

export function registerPublicApiRoutes(app: express.Application, sendJson: SendJson): void {
  app.get('/api/v1/movies', (req, res) => {
    const payload = buildPublicMoviesResponse(req.query);
    if ('error' in payload) return sendJson(res, payload, 400);
    return sendJson(res, payload);
  });

  app.get('/api/v1/actors', (_req, res) => sendJson(res, buildPublicActorsResponse()));
  app.get('/api/v1/actors/:id', (req, res) => {
    const payload = buildPublicActorResponse(req.params.id);
    if (!payload) return sendJson(res, { error: 'Actor not found.' }, 404);
    if ('error' in payload) return sendJson(res, payload, 400);
    return sendJson(res, payload);
  });

  app.get('/api/v1/ingredients', (_req, res) => sendJson(res, buildPublicIngredientsResponse()));
  app.get('/api/v1/ingredients/:id', (req, res) => {
    const payload = buildPublicIngredientResponse(req.params.id);
    if (!payload) return sendJson(res, { error: 'Ingredient not found.' }, 404);
    if ('error' in payload) return sendJson(res, payload, 400);
    return sendJson(res, payload);
  });
}
