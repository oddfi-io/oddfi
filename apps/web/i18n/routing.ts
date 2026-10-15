import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['zh', 'en', 'pt', 'ja', 'hi', 'es', 'tr', 'de', 'fr'],
  defaultLocale: 'en',
});

export type Locale = (typeof routing.locales)[number];
