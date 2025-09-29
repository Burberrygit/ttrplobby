// No zod? Keep it simple:
export const ALLOWED_SYSTEMS = new Set(['D&D 5e (2014)'] as const);
export const ALLOWED_LENGTHS = new Set([60,90,120,180]);

export function validateCreate(body: any) {
  if (!ALLOWED_SYSTEMS.has(body.system)) return 'invalid_system';
  if (!ALLOWED_LENGTHS.has(Number(body.length_minutes))) return 'invalid_length';
  if (typeof body.new_player_friendly !== 'boolean') return 'invalid_npf';
  if (typeof body.is_18_plus !== 'boolean') return 'invalid_adult';
  if (typeof body.is_private !== 'boolean') return 'invalid_privacy';
  return null;
}

export function validateQuickJoin(body: any) {
  if (!ALLOWED_SYSTEMS.has(body.system)) return 'invalid_system';
  if (!ALLOWED_LENGTHS.has(Number(body.length))) return 'invalid_length';
  if (typeof body.npf !== 'boolean') return 'invalid_npf';
  if (typeof body.adult !== 'boolean') return 'invalid_adult';
  return null;
}
