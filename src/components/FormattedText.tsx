'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface FormattedTextProps {
  text: string;
  className?: string;
}

/**
 * FormattedText component that automatically detects and styles hashtags.
 * Uses a regex that supports English alphanumeric characters, underscores, and Chinese characters.
 */
export function FormattedText({ text, className }: FormattedTextProps) {
  if (!text) return null;

  // Regex: # followed by one or more alphanumeric, underscore, or Chinese characters
  const parts = text.split(/(#[a-zA-Z0-9_\u4e00-\u9fa5]+)/g);

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {parts.map((part, i) => {
        if (part.startsWith('#')) {
          return (
            <span 
              key={i} 
              className="inline-block px-1 py-0.5 -mx-0.5 rounded-md text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-500/5 hover:bg-indigo-500/10 transition-colors"
            >
              {part}
            </span>
          );
        }
        return part;
      })}
    </span>
  );
}
