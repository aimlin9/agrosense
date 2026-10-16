import type { SelectOption } from '@/components/ui/SelectSheet';

export const GHANA_REGIONS = [
  'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern',
  'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah',
  'Upper East', 'Upper West', 'Volta', 'Western', 'Western North',
];

export const REGION_OPTIONS: SelectOption[] = GHANA_REGIONS.map((r) => ({ value: r, label: r }));

/**
 * Primary-crop choices. Crops the AI can diagnose come first; the rest are
 * staples farmers grow so weather advice and prices can still be tailored.
 */
export const CROP_OPTIONS: SelectOption[] = [
  { value: 'Tomato', label: 'Tomato', description: 'Photo diagnosis available' },
  { value: 'Maize', label: 'Maize', description: 'Photo diagnosis available' },
  { value: 'Bell pepper', label: 'Pepper', description: 'Photo diagnosis available' },
  { value: 'Potato', label: 'Potato', description: 'Photo diagnosis available' },
  { value: 'Orange', label: 'Orange', description: 'Photo diagnosis available' },
  { value: 'Cassava', label: 'Cassava' },
  { value: 'Cocoa', label: 'Cocoa' },
  { value: 'Yam', label: 'Yam' },
  { value: 'Plantain', label: 'Plantain' },
  { value: 'Rice', label: 'Rice' },
  { value: 'Groundnut', label: 'Groundnut' },
  { value: 'Cowpea', label: 'Cowpea' },
  { value: 'Onion', label: 'Onion' },
  { value: 'Okra', label: 'Okra' },
  { value: 'Garden egg', label: 'Garden egg' },
  { value: 'Pineapple', label: 'Pineapple' },
];

export const LANGUAGE_OPTIONS: SelectOption[] = [
  { value: 'en', label: 'English' },
  { value: 'tw', label: 'Twi', description: 'Coming soon — advice is in English for now' },
  { value: 'ha', label: 'Hausa', description: 'Coming soon — advice is in English for now' },
];

export const LEGAL = {
  privacy: 'https://aimlin9.github.io/agrosense/legal/privacy.html',
  terms: 'https://aimlin9.github.io/agrosense/legal/terms.html',
  website: 'https://aimlin9.github.io/agrosense/',
  supportEmail: 'oramsey609@gmail.com',
};
