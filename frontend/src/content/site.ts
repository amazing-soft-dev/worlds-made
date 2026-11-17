import { LIMITS } from '@worlds-made/shared';

/** All copy and figures for the marketing pages live here so they can be edited in one place. */
export const site = {
  name: 'Worlds Made',
  tagline: 'Describe a game. Play it in a minute.',
  description:
    'Describe a game in your own words, play it in your browser, share it with friends, and take on one fresh challenge every day.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  email: 'hello@worldsmade.example',

  nav: [
    { label: 'Create', href: '/create' },
    { label: 'Daily', href: '/daily' },
    { label: 'Gallery', href: '/gallery' },
    { label: 'Recommend', href: '/recommend' },
    { label: 'Pricing', href: '/pricing' },
  ],

  hero: {
    eyebrow: '★ AI GAME MAKER',
    title: 'Worlds Made',
    accent: 'Playable',
    lead: 'Tell us the game you imagine. We build it as one small, original, playable file, ready to play on your phone or laptop, share, or download.',
    primary: { label: 'make a game', href: '/create' },
    secondary: { label: "today's challenge", href: '/daily' },
  },

  steps: [
    { n: 'I', title: 'Describe', text: 'Write a sentence: a runner that dodges comets, a match-3 about lanterns.' },
    { n: 'II', title: 'Build', text: 'The maker starts from a tested game loop and fills in art, rules and sound.' },
    { n: 'III', title: 'Play', text: 'It runs in a sealed frame with keyboard and touch controls.' },
    { n: 'IV', title: 'Share', text: 'Publish to the gallery with a title, tags and the licence you choose.' },
    { n: 'V', title: 'Return', text: 'Come back daily for one puzzle everyone plays, with a streak and a leaderboard.' },
  ],

  features: [
    {
      id: 'create',
      eyebrow: 'The game maker',
      title: 'From a sentence to a game',
      text: 'Pick a starting style, describe your twist, and watch it build. If something is off, one click sends the errors back for a fix, or tell it what to change.',
      href: '/create',
      cta: 'start creating',
    },
    {
      id: 'daily',
      eyebrow: 'Every day at 00:00 UTC',
      title: 'The daily challenge',
      text: 'One short game, the same for everyone. Keep your streak alive and climb the top 100. Play without an account; sign in to save your streak.',
      href: '/daily',
      cta: 'play today',
    },
    {
      id: 'gallery',
      eyebrow: 'The community gallery',
      title: 'Play what others made',
      text: 'Browse new games, the most liked this week, and staff picks. Every game has a report button, and every game shows its licence.',
      href: '/gallery',
      cta: 'browse games',
    },
    {
      id: 'recommend',
      eyebrow: 'Find something to play',
      title: 'Game recommendations',
      text: 'Tell us what you feel like playing. We search a catalogue of over 500,000 real games and explain each pick in one line.',
      href: '/recommend',
      cta: 'get picks',
    },
  ],

  trust: [
    { title: 'Sealed games', text: 'Every game runs in a sandbox on a separate domain with no network access.' },
    { title: 'Kid-aware', text: 'No personal data from under-13s, no leaderboard names, no personalised ads.' },
    { title: 'Original only', text: 'We turn franchise requests into original look-alikes instead of copying.' },
  ],

  faq: [
    {
      q: 'Do I need an account to play?',
      a: 'No. Anyone can play the gallery and the daily challenge. You sign in to build games, like games and keep a streak.',
    },
    {
      q: 'Can kids use it?',
      a: 'Yes to play. Under-13s play anonymously, without sign-in or free-text fields. Building needs an account, so it is for people 13 and over (16 and over in the EEA).',
    },
    {
      q: 'Who owns my game?',
      a: 'You own what you contribute and grant us a licence to host, show and promote it. Copyright in purely AI-generated output is uncertain, so we make no promise about it.',
    },
    {
      q: 'Can I take my game with me?',
      a: 'Yes. Download a single .html file that opens offline, or a zip with a README ready for itch.io.',
    },
    {
      q: 'Why are there limits?',
      a: `Building a game costs real money. Free accounts get a small daily allowance (for example ${LIMITS.freeBuildsPerDay} builds a day) and repairs are included.`,
    },
  ],

  plans: [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      blurb: 'For trying ideas.',
      features: [
        `Example allowance: ${LIMITS.freeBuildsPerDay} builds a day`,
        `${LIMITS.freeRepairsPerBuild} free repairs per build`,
        'Publish to the gallery',
        'Daily challenge and streaks',
      ],
      cta: { label: 'start free', href: '/login' },
    },
    {
      id: 'paid',
      name: 'Maker',
      price: 'Price set at launch',
      blurb: 'For people who build a lot. Adults only.',
      features: ['A larger daily build allowance', 'Priority builds', 'Version history', 'Everything in Free'],
      cta: { label: 'see plans', href: '/account' },
    },
  ],

  footerLinks: [
    { label: 'Parents', href: '/parents' },
    { label: 'Terms', href: '/legal/terms' },
    { label: 'Privacy', href: '/legal/privacy' },
    { label: 'DMCA', href: '/legal/dmca' },
    { label: 'Credits', href: '/credits' },
  ],
} as const;

export type Site = typeof site;
