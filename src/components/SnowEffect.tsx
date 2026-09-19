import React, { useEffect, useRef } from 'react';

interface Snowflake {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  driftAngle: number;
  driftSpeed: number;
  driftAmp: number;
  opacity: number;
}

export const SnowEffect: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Respect prefers-reduced-motion: disable animation completely if requested
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let isRunning = true;

    // Adjust particle count: sparse, restrained holiday snowfall (not a blizzard)
    const isMobile = window.innerWidth < 640;
    const flakeCount = isMobile ? 16 : 28;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Generate initial sparse snowflakes with diverse attributes
    const flakes: Snowflake[] = Array.from({ length: flakeCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2.2 + 1.6, // mostly 1.6px - 3.8px
      speedY: Math.random() * 0.65 + 0.4, // gentle, non-rushed falling speed
      driftAngle: Math.random() * Math.PI * 2,
      driftSpeed: Math.random() * 0.015 + 0.008,
      driftAmp: Math.random() * 0.8 + 0.4,
      opacity: Math.random() * 0.35 + 0.5, // 0.5 - 0.85 opacity
    }));

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize, { passive: true });

    // Pause animation when page or tab is not visible to save CPU/battery
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isRunning = false;
        cancelAnimationFrame(animationFrameId);
      } else {
        if (!isRunning) {
          isRunning = true;
          animationFrameId = requestAnimationFrame(render);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const render = () => {
      if (!isRunning) return;

      ctx.clearRect(0, 0, width, height);

      // Render snowflakes
      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];

        // Gentle horizontal oscillation
        f.driftAngle += f.driftSpeed;
        const currentX = f.x + Math.sin(f.driftAngle) * f.driftAmp;

        ctx.save();
        ctx.beginPath();
        ctx.arc(currentX, f.y, f.radius, 0, Math.PI * 2);

        // Subtle cool grey/muted dark-green shadow so white flakes are clearly visible against warm cream
        ctx.shadowColor = 'rgba(26, 61, 47, 0.22)';
        ctx.shadowBlur = 2.5;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;

        ctx.fillStyle = `rgba(255, 255, 255, ${f.opacity})`;
        ctx.fill();
        ctx.restore();

        // Advance vertical movement
        f.y += f.speedY;

        // Wrap around seamlessly once disappeared below viewport
        if (f.y > height + 8) {
          f.y = -8;
          f.x = Math.random() * width;
        }

        // Wrap horizontal edges if drifted past bounds
        if (f.x > width + 10) {
          f.x = -10;
        } else if (f.x < -10) {
          f.x = width + 10;
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      id="xmasdb-snowfall-canvas"
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-10 w-full h-full"
    />
  );
};
