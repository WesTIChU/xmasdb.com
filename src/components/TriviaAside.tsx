import React from 'react';
import type { TriviaFact } from '../api/types';

interface TriviaAsideProps {
  fact?: TriviaFact;
  onNavigate: (path: string) => void;
  className?: string;
}

export const TriviaAside: React.FC<TriviaAsideProps> = ({ fact, onNavigate, className = '' }) => {
  if (!fact) return null;
  return (
    <section aria-labelledby="did-you-know-heading" className={`${className} border-t border-[#E7DFD5] pt-4`}>
      <div className="flex items-start gap-2.5">
        <span aria-hidden="true" className="pt-0.5 text-sm text-[#B8860B]">✦</span>
        <div className="min-w-0">
          <h2 id="did-you-know-heading" className="font-sans-clean text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8A6800]">Did you know?</h2>
          {fact.segments ? (
            <p className="mt-1 font-body text-sm leading-relaxed text-[#3A332B]">
              {fact.segments.map((segment, index) => segment.href ? (
                <a key={`${segment.text}-${index}`} href={segment.href} onClick={(event) => { event.preventDefault(); onNavigate(segment.href!); }} className="underline decoration-[#B8860B]/50 underline-offset-2 hover:text-[#841818] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A3D2F]">{segment.text}</a>
              ) : <React.Fragment key={`${segment.text}-${index}`}>{segment.text}</React.Fragment>)}
            </p>
          ) : fact.href ? (
            <a href={fact.href} onClick={(event) => { event.preventDefault(); onNavigate(fact.href!); }} className="mt-1 block font-body text-sm leading-relaxed text-[#3A332B] underline decoration-[#B8860B]/50 underline-offset-2 hover:text-[#841818] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A3D2F]">{fact.text}</a>
          ) : <p className="mt-1 font-body text-sm leading-relaxed text-[#3A332B]">{fact.text}</p>}
        </div>
      </div>
    </section>
  );
};
