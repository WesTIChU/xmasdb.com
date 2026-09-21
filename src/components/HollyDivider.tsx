import React from 'react';

interface HollyDividerProps {
  className?: string;
  lineClassName?: string;
  ornamentClassName?: string;
}

export const HollyDivider: React.FC<HollyDividerProps> = ({
  className = '',
  lineClassName = 'w-8',
  ornamentClassName = 'h-5 w-14',
}) => (
  <div className={`flex items-center justify-center gap-2 text-[#1A3D2F] ${className}`} aria-hidden="true">
    <span className={`h-px bg-[#B8860B]/60 ${lineClassName}`} />
    <svg className={ornamentClassName} viewBox="0 0 56 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 14C10 12 13 7 19 5M54 14C46 12 43 7 37 5" stroke="#1A3D2F" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M11 11C14 9 17 9 20 10M45 11C42 9 39 9 36 10M15 8C17 6 19 5 22 5M41 8C39 6 37 5 34 5" stroke="#1A3D2F" strokeWidth="1" strokeLinecap="round" />
      <circle cx="25" cy="10" r="2" fill="#841818" />
      <circle cx="31" cy="10" r="2" fill="#841818" />
      <path d="M27.8 3L28.5 5.1L30.7 5.1L28.9 6.4L29.6 8.5L27.8 7.2L26 8.5L26.7 6.4L24.9 5.1L27.1 5.1L27.8 3Z" fill="#B8860B" />
    </svg>
    <span className={`h-px bg-[#B8860B]/60 ${lineClassName}`} />
  </div>
);
