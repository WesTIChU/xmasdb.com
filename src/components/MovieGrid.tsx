import React from 'react';
import type { ListingMovie } from '../api/types';
import { MovieCard } from './MovieCard';

interface MovieGridProps {
  movies: ListingMovie[];
  onSelectMovie: (slug: string, tmdbId?: number) => void;
  emptyMessage?: string;
  naturalTitleHeight?: boolean;
}

export const MovieGrid: React.FC<MovieGridProps> = ({
  movies,
  onSelectMovie,
  emptyMessage = 'No movies found.',
  naturalTitleHeight = false,
}) => {
  if (movies.length === 0) {
    return (
      <div className="py-16 text-center text-[#736B63] font-body" id="empty-movies-message">
        <p className="text-base italic">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      id="movie-grid"
      className="catalogue-grid"
    >
      {movies.map((movie, index) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          onSelectMovie={onSelectMovie}
          priority={index < 3}
          reserveTitleHeight={!naturalTitleHeight}
        />
      ))}
    </div>
  );
};
