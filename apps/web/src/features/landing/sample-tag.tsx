import React from 'react';
import { FlaskConical } from 'lucide-react';

/** OD-21: visible marker on placeholder marketing content, development builds only. */
export function SampleTag({ show }: { show: boolean }) {
  if (!show || process.env.NODE_ENV === 'production') return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-accent/50 bg-accent-subtle px-2.5 py-0.5 text-xs font-semibold text-accent-subtle-fg">
      <FlaskConical size={12} aria-hidden />
      محتوى تجريبي — يُستبدل قبل الإطلاق
    </span>
  );
}
