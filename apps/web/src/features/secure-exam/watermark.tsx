import React from 'react';

/** Faint repeating identity text over the exam: deters screenshots/photos being shared. */
export function Watermark({ text }: { text: string }) {
  const safe = text.replace(/[&<>"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200"><text x="20" y="110" fill="currentColor" font-family="sans-serif" font-size="15" transform="rotate(-20 180 100)">${safe}</text></svg>`;
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg.replace('currentColor', '#808080'))}")`;
  return <div aria-hidden className="pointer-events-none fixed inset-0 z-20 opacity-[0.07]" style={{ backgroundImage: url }} />;
}
