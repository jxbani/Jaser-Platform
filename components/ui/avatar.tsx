import * as React from 'react';
import { cn } from '@/lib/utils';

export function Avatar({
  name,
  className
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      className={cn(
        'flex h-10 w-10 select-none items-center justify-center rounded-full bg-secondary text-sm font-medium text-secondary-foreground',
        className
      )}
      aria-hidden
    >
      {initials || '?'}
    </div>
  );
}
