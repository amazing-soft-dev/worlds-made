/** Country choices for the age gate. The backend uses the code for the EEA and UK 16+ rule, so the list is ISO 3166-1 alpha-2. */
export const COUNTRIES: ReadonlyArray<readonly [code: string, name: string]> = [
  ['US', 'United States'], ['GB', 'United Kingdom'], ['CA', 'Canada'], ['AU', 'Australia'], ['NZ', 'New Zealand'], ['IE', 'Ireland'],
  ['DE', 'Germany'], ['FR', 'France'], ['ES', 'Spain'], ['IT', 'Italy'], ['NL', 'Netherlands'], ['BE', 'Belgium'], ['AT', 'Austria'],
  ['CH', 'Switzerland'], ['SE', 'Sweden'], ['NO', 'Norway'], ['DK', 'Denmark'], ['FI', 'Finland'], ['IS', 'Iceland'], ['PL', 'Poland'],
  ['PT', 'Portugal'], ['GR', 'Greece'], ['CZ', 'Czechia'], ['HU', 'Hungary'], ['RO', 'Romania'], ['BG', 'Bulgaria'], ['HR', 'Croatia'],
  ['SK', 'Slovakia'], ['SI', 'Slovenia'], ['EE', 'Estonia'], ['LV', 'Latvia'], ['LT', 'Lithuania'], ['LU', 'Luxembourg'], ['MT', 'Malta'],
  ['CY', 'Cyprus'], ['LI', 'Liechtenstein'], ['JP', 'Japan'], ['KR', 'South Korea'], ['IN', 'India'], ['BR', 'Brazil'], ['MX', 'Mexico'],
  ['ZA', 'South Africa'], ['SG', 'Singapore'], ['XX', 'Somewhere else'],
];
