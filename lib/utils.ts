import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(microAmount: bigint | number | string, currency = 'USD') {
  const value =
    typeof microAmount === 'bigint'
      ? Number(microAmount) / 100
      : Number(microAmount) / 100;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(value);
}
