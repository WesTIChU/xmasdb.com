import { getAllActors } from '../data/actors';
import { MOVIES } from '../data/movies';

export function getMoviesBySlug(slug: string) {
  const clean = slug.toLowerCase().trim();
  return MOVIES.filter((movie) => movie.slug.toLowerCase() === clean);
}

export function getActorsBySlug(slug: string) {
  const clean = slug.toLowerCase().trim();
  return getAllActors().filter((actor) => actor.slug.toLowerCase() === clean);
}
