import React from 'react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className = 'h-20 sm:h-28 md:h-36 lg:h-44 w-auto max-w-full' }) => {
  return (
    <img
      src="/logo.png"
      alt="XmasDB.com — A curated collection of Christmas movies"
      className={`${className} object-contain mx-auto drop-shadow-xs`}
      referrerPolicy="no-referrer"
    />
  );
};
