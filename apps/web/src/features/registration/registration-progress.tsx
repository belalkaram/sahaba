import React from 'react';
import { Check } from 'lucide-react';
import { STEPS } from './form-state';
import { formatNumber } from '../../lib/format';
import { cn } from '../../lib/cn';

/** Step indicator with a progress bar. Completed steps can be revisited. */
export function RegistrationProgress({ current, onJump }: { current: number; onJump: (step: number) => void }) {
  const percent = Math.round((current / (STEPS.length - 1)) * 100);

  return (
    <div className="space-y-4" aria-label="تقدم التسجيل">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-fg">
          الخطوة {formatNumber(current + 1)} من {formatNumber(STEPS.length)} — {STEPS[current].title}
        </span>
        <span className="font-semibold text-primary" aria-hidden>
          {formatNumber(percent)}٪
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="نسبة إكمال التسجيل"
        className="h-2 overflow-hidden rounded-full bg-surface-muted"
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>

      <ol className="hidden grid-cols-6 gap-2 sm:grid">
        {STEPS.map((s, i) => {
          const done = i < current;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => done && onJump(i)}
                disabled={!done}
                aria-current={i === current ? 'step' : undefined}
                className={cn(
                  'flex w-full flex-col items-center gap-1.5 rounded-md py-1 text-xs transition-colors',
                  done && 'cursor-pointer text-fg hover:bg-surface-muted',
                  i === current && 'font-bold text-primary',
                  i > current && 'text-fg-subtle',
                )}
              >
                <span
                  className={cn(
                    'grid h-8 w-8 place-items-center rounded-full border-2 text-sm font-bold',
                    done && 'border-primary bg-primary text-primary-fg',
                    i === current && 'border-primary text-primary',
                    i > current && 'border-border text-fg-subtle',
                  )}
                >
                  {done ? <Check size={16} aria-hidden /> : formatNumber(i + 1)}
                </span>
                <span className="text-center leading-tight">{s.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
