'use client';

import React, { useState, useEffect } from 'react';

import { Search, X } from 'lucide-react';
export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'بحث...',
  debounceMs = 300,
  className = '',
}) => {
  const [innerValue, setInnerValue] = useState(value);

  useEffect(() => {
    setInnerValue(value);
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (innerValue !== value) {
        onChange(innerValue);
      }
    }, debounceMs);

    return () => clearTimeout(handler);
  }, [innerValue, debounceMs, onChange, value]);

  return (
    <div className={`relative flex items-center ${className}`}>
      <div className="absolute start-3 text-fg-muted pointer-events-none text-xs">
        
 <Search size={16} strokeWidth={1.75} aria-hidden />
 </div>
      <input
        type="text"
        value={innerValue}
        onChange={(e) => setInnerValue(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-sm border border-border bg-surface ps-8 pe-8 py-2 text-xs text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
      />
      {innerValue && (
        <button
          type="button"
          onClick={() => {
            setInnerValue('');
            onChange('');
          }}
          className="absolute end-2.5 text-xs text-fg-subtle hover:text-fg p-0.5 rounded-full"
          aria-label="مسح البحث"
        >
          
 <X size={16} strokeWidth={1.75} aria-hidden />
 </button>
      )}
    </div>
  );
};

