'use client';

import { useTransition } from 'react';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setLocale } from '@/app/actions/locale';
import type { Locale } from '@/lib/i18n';

export function LocaleToggle({ current }: { current: Locale }) {
  const [pending, start] = useTransition();
  const next: Locale = current === 'ar' ? 'en' : 'ar';

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => start(() => setLocale(next))}
      aria-label="Toggle language"
    >
      <Languages className="h-4 w-4" />
      <span>{next === 'ar' ? 'العربية' : 'English'}</span>
    </Button>
  );
}
