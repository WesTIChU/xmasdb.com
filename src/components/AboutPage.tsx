import React from 'react';
import type { AboutPayload } from '../api/types';
import { MovieCard } from './MovieCard';
import { getActorPath, getMoviePath } from '../utils/urls';

interface AboutPageProps {
  payload: AboutPayload;
  onNavigate: (path: string) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ payload, onNavigate }) => {
  const today = new Date();
  const birthday = new Date(today.getFullYear(), 2, 1);
  const age = today.getFullYear() - 1984 - (today < birthday ? 1 : 0);
  const actorLink = (actorIndex: number) => {
    const actor = payload.favouriteActors[actorIndex];
    const path = getActorPath(actor.tmdbPersonId, actor.slug);
    return (
      <a
        href={path}
        onClick={(event) => {
          event.preventDefault();
          onNavigate(path);
        }}
        className="text-[#841818] underline decoration-[#C8BFB3] underline-offset-2 hover:text-[#1A3D2F]"
      >
        {actor.name}
      </a>
    );
  };

  return (
    <article className="mx-auto max-w-2xl py-10 sm:py-14" aria-labelledby="about-heading">
      <header className="border-b border-[#E7DFD5] pb-6 text-center">
        <h1 id="about-heading" className="font-heading text-3xl font-semibold text-[#1A3D2F] sm:text-4xl">Why XmasDB Exists</h1>
      </header>

      <div className="mt-8 space-y-5 font-body text-base leading-relaxed text-[#4A433B] sm:text-lg">
        <p className="font-heading text-2xl font-semibold text-[#1A3D2F] sm:text-3xl">Hi, I&apos;m Paul.</p>
        <p>I&apos;m from Scotland, I&apos;m {age}, and I ain&apos;t gonna lie, I love a wee Christmas movie throughout the year. I&apos;ve never really understood why we&apos;re supposed to save them all for December. Sometimes you just want a ridiculously festive film in the middle of March.</p>
        <p>XmasDB actually started because of Radarr. I wanted a reliable way to keep track of Hallmark and Lifetime Christmas movies and feed them straight into my collection. I used Trakt for a while, but after changes to their site it just stopped being as reliable as I wanted for my setup.</p>
        <p>Eventually I thought, sod it. I&apos;ll make my own.</p>
        <p>It started off as something pretty simple for myself, but, as these things tend to do, it grew arms and legs. Now there are hundreds of movies, thousands of actors, upcoming releases, yearly archives and feeds for Hallmark, Lifetime, Great American Family and UPtv.</p>
        <p>I still mainly build XmasDB for myself. There&apos;s no big company behind it and I&apos;m not trying to turn it into some massive commercial thing. I just wanted a Christmas movie database and Radarr feed that worked the way I wanted it to work.</p>
        <p>And yes, I used AI to help me build parts of it. I&apos;m not going to pretend I didn&apos;t or hide it. It helped me turn an idea I had into something that actually works, and I&apos;m perfectly happy with that.</p>
        <p>If you&apos;ve stumbled across XmasDB and it helps you find a film, keep your own Christmas collection up to date, or just waste half an hour looking through Christmas movies in July, brilliant.</p>
        <p>If you like it, you like it. If you don&apos;t, you don&apos;t.</p>
        <p>Paul</p>
      </div>

      <section className="mt-12 border-t border-[#E7DFD5] pt-8" aria-labelledby="favourites-heading">
        <p className="font-sans-clean text-xs font-semibold uppercase tracking-[0.18em] text-[#841818]">A FEW OF MY FAVOURITES</p>
        <h2 id="favourites-heading" className="mt-1 font-heading text-2xl font-semibold text-[#1A3D2F] sm:text-3xl">Christmas Movies I Love</h2>
        <p className="mt-3 font-body text-base leading-relaxed text-[#4A433B] sm:text-lg">
          I couldn&apos;t have a Christmas movie site without mentioning a few of my own favourites. There are a handful of Christmas movies I can happily go back to again and again.
        </p>

        <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4" aria-label="Paul's favourite Christmas movies">
          {payload.favouriteMovies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} onSelectMovie={(slug, tmdbId) => onNavigate(getMoviePath(tmdbId || movie.tmdbId, slug))} />
          ))}
        </div>

        <div className="mt-8 space-y-3 font-body text-base leading-relaxed text-[#4A433B] sm:text-lg">
          <p>Once Upon a Holiday is probably the big one for me. Definitely one of my favourites.</p>
          <p>I&apos;m a big {actorLink(0)} fan, and Christmas by Starlight is one I can happily watch again.</p>
          <p>I love {actorLink(1)} too.</p>
          <p>Coyote Creek Christmas is another favourite, with{' '}
            {actorLink(2)}.
          </p>
        </div>
      </section>

      <section className="mt-12 border-t border-[#E7DFD5] pt-8" aria-labelledby="data-attribution-heading">
        <h2 id="data-attribution-heading" className="font-heading text-2xl font-semibold text-[#1A3D2F] sm:text-3xl">Data &amp; Attribution</h2>
        <div className="mt-4 flex flex-col items-start gap-3 text-sm leading-relaxed text-[#736B63] font-sans-clean sm:flex-row sm:items-center sm:gap-4">
          <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" aria-label="Visit TMDB">
            <img
              src="https://www.themoviedb.org/assets/v4/logos/v2/blue_long_2-9665a76b1ae401a510ec1e0ca40ddcb3b0cfe45f1d51b77a308fea0845885648.svg"
              alt="TMDB"
              className="h-auto w-[100px] max-w-[110px]"
            />
          </a>
          <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
        </div>
      </section>
    </article>
  );
};
