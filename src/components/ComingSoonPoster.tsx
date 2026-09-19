import React from 'react';

interface ComingSoonPosterProps {
  title: string;
  year: number;
  networkName?: string;
  className?: string;
}

export const ComingSoonPoster: React.FC<ComingSoonPosterProps> = ({
  title,
  year,
  networkName,
  className = '',
}) => {
  const titleSize = title.length > 38 ? '0.78rem' : title.length > 27 ? '0.9rem' : '1.05rem';

  return (
    <div
      className={`relative w-full h-full aspect-2/3 bg-gradient-to-b from-[#143325] via-[#1B3E2F] to-[#0E2319] text-[#FAF7F2] flex flex-col justify-between p-3 sm:p-4 select-none overflow-hidden ${className}`}
      aria-label={`Coming soon poster for ${title}`}
    >
      {/* Decorative festive corner flourishes */}
      <div className="absolute inset-2 border border-[#B8860B]/35 pointer-events-none rounded-xs flex flex-col justify-between p-2">
        <div className="flex justify-between text-[#B8860B]/60 text-[10px] leading-none">
          <span>✦</span>
          <span>✦</span>
        </div>
        <div className="flex justify-between text-[#B8860B]/60 text-[10px] leading-none">
          <span>✦</span>
          <span>✦</span>
        </div>
      </div>

      {/* Top: Network branding */}
      <div className="relative z-10 text-center pt-2">
        <span className="inline-block max-w-full px-1.5 py-0.5 rounded text-[8px] leading-tight tracking-[0.12em] font-sans-clean font-semibold uppercase bg-black/30 text-[#DCD3C7] border border-[#B8860B]/30">
          {networkName || 'Holiday Premiere'}
        </span>
      </div>

      {/* Center: Coming Soon banner & Movie Title */}
      <div className="relative z-10 my-auto text-center px-1 py-2">
        <div className="flex items-center justify-center gap-1 mb-1.5 text-[#D4AF37]">
          <span className="text-[10px]">✧</span>
          <p className="font-heading text-[9px] tracking-[0.16em] text-[#D4AF37] uppercase font-semibold">
            Coming Soon
          </p>
          <span className="text-[10px]">✧</span>
        </div>

        <h3
          className="font-heading font-semibold text-[#FFFDF9] leading-tight drop-shadow-sm break-words"
          style={{ fontSize: titleSize }}
        >
          {title}
        </h3>

        <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-body italic text-[#E5DDCF]/90">
          <span className="w-3 h-px bg-[#B8860B]/40" />
          <span>Christmas {year}</span>
          <span className="w-3 h-px bg-[#B8860B]/40" />
        </div>
      </div>

      {/* Bottom: XmasDB badge */}
      <div className="relative z-10 text-center pb-2">
        <p className="text-[8px] tracking-wider text-[#A89F93] font-sans-clean uppercase">
          XmasDB.com
        </p>
      </div>
    </div>
  );
};
