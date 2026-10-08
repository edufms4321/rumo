import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Junta classes resolvendo conflito do Tailwind (a ultima vence). */
export function cn(...entradas: ClassValue[]): string {
  return twMerge(clsx(entradas));
}
