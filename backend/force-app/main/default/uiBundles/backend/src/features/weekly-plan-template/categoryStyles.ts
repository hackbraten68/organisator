import { BookOpen, Coffee, Star, Video, type LucideIcon } from 'lucide-react';

import type { EntryCategory } from './types';

export interface CategoryStyle {
  label: string;
  description: string;
  icon: LucideIcon;
  cellClass: string;
  cardClass: string;
  badgeClass: string;
  dotClass: string;
}

export const CATEGORY_ORDER: EntryCategory[] = ['live', 'async', 'break', 'special'];

export const CATEGORY_STYLES: Record<EntryCategory, CategoryStyle> = {
  live: {
    label: 'Live-Unterricht',
    description: 'Synchroner Unterricht mit Trainer',
    icon: Video,
    cellClass: 'border-sky-200 bg-sky-50',
    cardClass: 'border-sky-300 bg-sky-100',
    badgeClass: 'bg-sky-200 text-sky-950',
    dotClass: 'bg-sky-500',
  },
  async: {
    label: 'Asynchron',
    description: 'Selbstständige Lern- und Arbeitsphase',
    icon: BookOpen,
    cellClass: 'border-emerald-200 bg-emerald-50',
    cardClass: 'border-emerald-300 bg-emerald-100',
    badgeClass: 'bg-emerald-200 text-emerald-950',
    dotClass: 'bg-emerald-500',
  },
  break: {
    label: 'Pause',
    description: 'Kaffeepause, Mittagspause oder Nachmittagspause',
    icon: Coffee,
    cellClass: 'border-amber-200 bg-amber-50',
    cardClass: 'border-amber-200 bg-amber-100',
    badgeClass: 'bg-amber-200 text-amber-950',
    dotClass: 'bg-amber-400',
  },
  special: {
    label: 'Sondertermin',
    description: 'Zusätzlicher Termin außerhalb des Standardrhythmus',
    icon: Star,
    cellClass: 'border-violet-200 bg-violet-50',
    cardClass: 'border-violet-300 bg-violet-100',
    badgeClass: 'bg-violet-200 text-violet-950',
    dotClass: 'bg-violet-500',
  },
};
