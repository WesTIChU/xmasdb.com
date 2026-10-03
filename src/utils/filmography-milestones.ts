import type { ActorFilmographyItem } from '../api/types';
import { getMoviePremiereDateKey } from './catalogue-lifecycle';

export interface FilmographyMilestone {
  movie: ActorFilmographyItem;
  dateKey: string | null;
}

export interface FilmographyMilestones {
  first: FilmographyMilestone;
  latest: FilmographyMilestone;
}

function compareMovies(left: FilmographyMilestone, right: FilmographyMilestone): number {
  if (left.movie.year !== right.movie.year) return left.movie.year - right.movie.year;
  if (left.dateKey && right.dateKey && left.dateKey !== right.dateKey) return left.dateKey.localeCompare(right.dateKey);
  if (left.dateKey !== right.dateKey) return left.dateKey ? -1 : 1;
  return left.movie.title.localeCompare(right.movie.title) || left.movie.tmdbId - right.movie.tmdbId;
}

export function getFilmographyMilestones(movies: ActorFilmographyItem[]): FilmographyMilestones | null {
  if (movies.length === 0) return null;
  const milestones = movies.map((movie) => ({
    movie,
    dateKey: getMoviePremiereDateKey({ releaseDate: movie.releaseDate }),
  })).sort(compareMovies);
  return {
    first: milestones[0],
    latest: milestones[milestones.length - 1],
  };
}
