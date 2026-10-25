import type { Tier } from '../types/report.js';

export const TIER_NAMES: Record<Tier, string> = {
  official: 'Official / exchange / index provider',
  press: 'Established news outlet',
  data: 'Data provider / research',
  other: 'Other',
};
