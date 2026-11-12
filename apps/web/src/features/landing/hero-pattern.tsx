import React from 'react';

/**
 * Gulf khatam (eight-point star) lattice behind the hero, as inline strokes so it can draw itself
 * (DrawSVG, LANDING-V2 L2). It replaces the `pattern-overlay` mask here: a mask over a large area
 * is repainted on every scroll, while this is one static SVG the browser rasterises once.
 */
export function HeroPattern() {
  const stars = [
    { x: 120, y: 120, r: 54 },
    { x: 300, y: 70, r: 38 },
    { x: 470, y: 160, r: 46 },
    { x: 210, y: 300, r: 42 },
    { x: 410, y: 390, r: 34 },
    { x: 90, y: 440, r: 30 },
  ];

  return (
    <svg
      data-hero-pattern
      viewBox="0 0 560 520"
      fill="none"
      aria-hidden
      className="pointer-events-none absolute -top-10 start-[-6rem] h-[34rem] w-[36rem] text-primary/25 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_72%)] sm:start-[-4rem] lg:start-auto lg:end-[-8rem] lg:h-[40rem] lg:w-[42rem]"
    >
      <g stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round">
        {stars.map((s) => (
          <g key={`${s.x}-${s.y}`}>
            <path data-draw d={star(s.x, s.y, s.r)} />
            <path data-draw d={star(s.x, s.y, s.r * 0.6)} />
          </g>
        ))}
        {/* Clouds echoing the brand mark */}
        <path data-draw d="M55 490 A55 55 0 0 0 108 428 A72 72 0 0 0 220 422 A52 52 0 0 0 268 478 L268 490 Z" />
        <path data-draw d="M310 490 A42 42 0 0 0 352 442 A54 54 0 0 0 450 438 A38 38 0 0 0 480 480 L480 490 Z" />
        <path data-draw d="M0 250h560" strokeDasharray="2 10" />
        <path data-draw d="M0 180h560" strokeDasharray="2 10" />
      </g>
    </svg>
  );
}

/** Eight-point star as two overlaid squares, the classic khatam outline. */
function star(cx: number, cy: number, r: number): string {
  const square = (angle: number) =>
    Array.from({ length: 4 }, (_, i) => {
      const a = angle + (i * Math.PI) / 2;
      return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(' L ');

  return `M ${square(0)} Z M ${square(Math.PI / 4)} Z`;
}
