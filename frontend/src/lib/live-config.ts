// frontend/src/lib/live-config.ts
export const SYSTEMS = [
  { slug: 'dnd-5e-2014', label: 'D&D 5e (2014)' },
  // add more when you support them:
  // { slug: 'dnd-5e-2024', label: 'D&D 5e (2024)' },
  // { slug: 'pathfinder-2e', label: 'Pathfinder 2e' },
] as const;

export type SystemLabel = typeof SYSTEMS[number]['label'];
export type SystemSlug  = typeof SYSTEMS[number]['slug'];

export const LENGTHS_MINUTES = [60, 90, 120, 180] as const;

export const DEFAULTS = {
  systemLabel: 'D&D 5e (2014)' as SystemLabel,
  length: 120 as (typeof LENGTHS_MINUTES)[number],
  newPlayerFriendly: true,
  is18Plus: false,
  isPrivate: false,
};
