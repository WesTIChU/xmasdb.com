import React, { useState, useEffect } from 'react';

export const ScrollToTopButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Reveal button once scrolled down a bit
      if (window.scrollY > 280) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <button
      type="button"
      id="scroll-to-top-btn"
      onClick={scrollToTop}
      title="Scroll to top"
      aria-label="Scroll to top"
      className={`fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 p-2.5 rounded-full bg-[#FAF7F2] hover:bg-[#FFFDF9] border border-[#DDD4C6] hover:border-[#1A3D2F] text-[#1A3D2F] shadow-sm hover:shadow-md transition-all duration-300 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1A3D2F]/40 ${
        isVisible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <span className="sr-only">Scroll back to top</span>
      {/* Cute Christmas Tree with Golden Star and Holiday Evergreen Tiers */}
      <svg
        className="w-6 h-6 transform group-hover:scale-110 group-hover:-translate-y-0.5 transition-transform duration-200"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Golden Holiday Star at the Top */}
        <polygon
          points="12,1.2 13.3,4.1 16.5,4.3 14,6.4 14.8,9.5 12,7.9 9.2,9.5 10,6.4 7.5,4.3 10.7,4.1"
          fill="#B8860B"
          stroke="#946C08"
          strokeWidth="0.4"
        />

        {/* Tree Top Tier */}
        <path
          d="M12 4.2 L15.5 8.5 L13.5 8.5 L17 12.8 L14.5 12.8 L18.5 18 L5.5 18 L9.5 12.8 L7 12.8 L10.5 8.5 L8.5 8.5 Z"
          fill="#1A3D2F"
          stroke="#143626"
          strokeWidth="0.6"
          strokeLinejoin="round"
        />

        {/* Delicate Tree Trunk */}
        <rect x="10.5" y="18" width="3" height="3" rx="0.5" fill="#6B4423" />

        {/* Tiny Decorative Holiday Tree Baubles (Festive Crimson & Warm Gold Dots) */}
        <circle cx="12" cy="7.2" r="0.7" fill="#841818" />
        <circle cx="10" cy="11.5" r="0.75" fill="#D4AF37" />
        <circle cx="14" cy="11.5" r="0.75" fill="#841818" />
        <circle cx="8" cy="16" r="0.8" fill="#841818" />
        <circle cx="12" cy="15.2" r="0.8" fill="#D4AF37" />
        <circle cx="16" cy="16" r="0.8" fill="#841818" />
      </svg>
    </button>
  );
};
