import React from 'react';

export const NavSquiggle: React.FC<{ isActive?: boolean; strokeColor?: string }> = ({ isActive, strokeColor = '#1A3D2F' }) => (
  <svg
    className={`nav-squiggle ${isActive ? 'is-active' : ''}`}
    viewBox="0 0 100 8"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <path
      d="M1,5.2 C14,1.8 27,7.2 41,3.6 C55,0.8 69,6.8 83,3.2 C91,1.5 96,4.5 99,4"
      fill="none"
      stroke={strokeColor}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface NavigationLinkProps {
  href: string;
  children: React.ReactNode;
  onNavigate?: (path: string) => void;
  isActive?: boolean;
  className?: string;
  id?: string;
  title?: string;
  squiggleColor?: string;
}

export const NavigationLink: React.FC<NavigationLinkProps> = ({
  href,
  children,
  onNavigate,
  isActive = false,
  className = '',
  id,
  title,
  squiggleColor,
}) => (
  <a
    href={href}
    id={id}
    title={title}
    onClick={(event) => {
      if (!onNavigate) return;
      event.preventDefault();
      onNavigate(href);
    }}
    className={`xmas-nav-link ${isActive ? 'is-active text-[#1A3D2F]' : ''} ${className}`}
  >
    <span className="relative inline-block leading-normal">
      {children}
      <NavSquiggle isActive={isActive} strokeColor={squiggleColor} />
    </span>
  </a>
);

interface NavigationTabProps {
  children: React.ReactNode;
  onClick: () => void;
  isActive?: boolean;
  className?: string;
  id?: string;
  role?: string;
  'aria-selected'?: boolean;
}

export const NavigationTab: React.FC<NavigationTabProps> = ({
  children,
  onClick,
  isActive = false,
  className = '',
  id,
  role,
  'aria-selected': ariaSelected,
}) => (
  <button
    type="button"
    id={id}
    role={role}
    aria-selected={ariaSelected}
    onClick={onClick}
    className={`xmas-nav-link ${isActive ? 'is-active text-[#1A3D2F]' : ''} ${className}`}
  >
    <span className="relative inline-block leading-normal">
      {children}
      <NavSquiggle isActive={isActive} />
    </span>
  </button>
);
