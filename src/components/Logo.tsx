import React from 'react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className = 'h-20 sm:h-28 md:h-36 lg:h-44 w-auto max-w-full' }) => {
  return (
    <img
      src="/logo-550.webp"
      srcSet="/logo-550.webp 550w, /logo-1100.webp 1100w"
      sizes="(min-width: 1024px) 527px, 240px"
      alt="XmasDB.com — A curated collection of Christmas movies"
      className={`${className} object-contain mx-auto drop-shadow-xs`}
      width={550}
      height={184}
      fetchPriority="high"
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
};
