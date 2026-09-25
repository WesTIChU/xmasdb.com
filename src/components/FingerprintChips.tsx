import React from 'react';
import type { FingerprintDefinition } from '../data/fingerprints';
import { getFingerprintPath } from '../utils/urls';

interface FingerprintChipsProps {
  fingerprints: FingerprintDefinition[];
  onNavigate: (path: string) => void;
}

export const FingerprintChips: React.FC<FingerprintChipsProps> = ({ fingerprints, onNavigate }) => (
  <div className="flex flex-wrap gap-2">
    {fingerprints.map((fingerprint) => (
      <a
        key={fingerprint.id}
        href={getFingerprintPath(fingerprint.id)}
        onClick={(event) => {
          event.preventDefault();
          onNavigate(getFingerprintPath(fingerprint.id));
        }}
        className="cursor-pointer rounded-full border border-[#DCD3C7] bg-[#FFFDF9] px-3 py-1 text-xs font-sans-clean text-[#1A3D2F] transition-colors hover:border-[#1A3D2F] hover:bg-[#FAF7F2] hover:text-[#1A3D2F] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A3D2F]/20 focus-visible:ring-offset-1"
      >
        {fingerprint.label}
      </a>
    ))}
  </div>
);
