import React from 'react';
import type { ListingMovie } from '../api/types';
import { MovieCard } from './MovieCard';

interface MovieGridProps {
  movies: ListingMovie[];
  onSelectMovie: (slug: string, tmdbId?: number) => void;
  emptyMessage?: string;
}

export const MovieGrid: React.FC<MovieGridProps> = ({
  movies,
  onSelectMovie,
  emptyMessage = 'No movies found.',
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
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-4xl mx-auto"
    >
      {movies.map((movie, index) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          onSelectMovie={onSelectMovie}
          priority={index < 3}
        />
      ))}
    </div>
  );
};
