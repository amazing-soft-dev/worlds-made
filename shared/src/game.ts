import { z } from 'zod';

export const gameStatusSchema = z.enum(['draft', 'published', 'hidden', 'removed']);
export const gameVisibilitySchema = z.enum(['private', 'public']);
export const planSchema = z.enum(['free', 'paid']);

/** Gallery licences a creator can pick on publish; shown on the play page and in downloads. */
export const licenseSchema = z.enum(['all-rights-reserved', 'cc-by', 'cc-by-sa', 'cc-by-nc', 'cc0']);

export const LICENSE_LABELS: Record<z.infer<typeof licenseSchema>, string> = {
  'all-rights-reserved': 'All rights reserved',
  'cc-by': 'Creative Commons Attribution 4.0',
  'cc-by-sa': 'Creative Commons Attribution-ShareAlike 4.0',
  'cc-by-nc': 'Creative Commons Attribution-NonCommercial 4.0',
  cc0: 'CC0 1.0 Public Domain Dedication',
};

export const galleryTabSchema = z.enum(['new', 'top-week', 'staff-picks']);

export type GameStatus = z.infer<typeof gameStatusSchema>;
export type GameVisibility = z.infer<typeof gameVisibilitySchema>;
export type Plan = z.infer<typeof planSchema>;
export type License = z.infer<typeof licenseSchema>;
export type GalleryTab = z.infer<typeof galleryTabSchema>;
