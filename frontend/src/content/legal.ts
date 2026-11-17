import { LIMITS } from '@worlds-made/shared';

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalDoc {
  title: string;
  description: string;
  intro: string;
  sections: LegalSection[];
}

/**
 * Plain-language policies. They describe what the product actually does (see docs/KIDS-COMPLIANCE.md) and are a
 * draft until a lawyer has reviewed them.
 */
export const parents: LegalDoc = {
  title: 'For parents',
  description: 'How Worlds Made handles kids, ads and data.',
  intro: 'Kids are a core audience here, so we collect as little as we can. This page says exactly what happens when a child plays.',
  sections: [
    {
      heading: 'Under 13',
      bullets: [
        'No account. Children under 13 can play the daily challenge, the gallery and the recommendations without signing in.',
        'No personal data. We store only a random anonymous id on their device, so a daily streak can work.',
        'No free text. Under-13s cannot type names, comments or descriptions anywhere on the site, and there are no comments at all.',
        'No leaderboard name. Their scores appear as "Guest".',
        'No personalised ads. Ad requests for under-13s, and for visitors whose age we do not know, are marked as child-directed, which turns off personalised ads and third-party ad vendors.',
      ],
    },
    {
      heading: 'Ages 13 to 17',
      bullets: [
        'Teens can make an account with a parent-friendly email sign-in. In the EEA and UK the minimum age is 16.',
        'Teens never choose a public name: a generated nickname is shown on leaderboards and next to their games.',
        'Ads are shown without personalisation.',
        'The paid plan is for adults. A teen who wants it should ask a parent to sign up on their own account.',
      ],
    },
    {
      heading: 'How the age question works',
      paragraphs: [
        'When someone makes an account we ask the year they were born, with no hint about which answer unlocks more. We keep the year, not a full birthday. The answer is remembered, so changing it later is not possible.',
      ],
    },
    {
      heading: 'The games themselves',
      bullets: [
        'Every game is written by an AI from a prompt, so we treat each one as untrusted code. Games run in a sealed frame on a separate domain with no network access and cannot reach your account or cookies.',
        'Prompts and the text inside games are checked before anything is shown. Franchise names are swapped for original look-alikes.',
        'Every published game has a Report button. A game with enough reports is hidden until a person reviews it.',
      ],
    },
    {
      heading: 'Tracking and analytics',
      paragraphs: ['We use cookie-light analytics with no ad pixels and no cross-site tracking anywhere on the site.'],
    },
    {
      heading: 'How long we keep things',
      bullets: [
        `Anonymous ids, streaks and scores are deleted after ${LIMITS.anonRetentionDays} days without play.`,
        `Accounts with no activity for ${LIMITS.inactiveAccountDays} days (about two years) are deleted.`,
      ],
    },
    {
      heading: 'Talk to us',
      paragraphs: ['Questions, or want something deleted? Use the contact details on the Privacy Policy page.'],
    },
  ],
};

export const terms: LegalDoc = {
  title: 'Terms of use',
  description: 'The rules for using Worlds Made.',
  intro: 'By using Worlds Made you agree to these terms. They are written to be read.',
  sections: [
    {
      heading: 'Who can use the site',
      paragraphs: ['Anyone can play. You need an account to build games, like games and keep a streak, and accounts are for people 13 and over (16 and over in the EEA and UK). The paid plan is for adults.'],
    },
    {
      heading: 'What you make',
      paragraphs: [
        'You own what you contribute, such as your prompts, titles and descriptions. You give Worlds Made a licence to host, show and promote the games you publish.',
        'Games are written by an AI. Copyright in purely AI-generated output is uncertain, so we do not promise you any rights in it beyond what the law gives you.',
      ],
    },
    {
      heading: 'Licences on published games',
      paragraphs: ['When you publish you choose a licence, for example "All rights reserved" or a Creative Commons option. It is shown on the play page and in every download. Other people may use your game only as that licence allows.'],
    },
    {
      heading: 'What is not allowed',
      bullets: [
        'Copying named characters, logos, music or levels from other games. Genres and mechanics are fine.',
        'Content that is sexual, hateful, gory or aimed at real people.',
        'Trying to break, probe or bypass the sandbox, the limits or the moderation.',
        'Making many accounts to get around the free daily limit.',
      ],
    },
    {
      heading: 'Moderation',
      paragraphs: ['We check prompts, game text, titles, descriptions and tags, and we may hide or remove anything that breaks these terms. A game with enough reports is hidden until we review it, and we aim to do that within 48 hours.'],
    },
    {
      heading: 'Limits and payments',
      paragraphs: [
        'Free accounts have a small daily allowance of builds because building costs real money. Paid plans are billed by Stripe and can be cancelled in the customer portal. We never see your card details.',
        'The daily challenge has no prizes. Scores come from your browser and can be faked.',
      ],
    },
    {
      heading: 'Copyright complaints',
      paragraphs: ['If you think a game copies your work, follow the steps on the DMCA page and we will act quickly.'],
    },
    {
      heading: 'No guarantees',
      paragraphs: ['The site and its games are provided as they are. We try to keep everything safe and available but cannot promise it will always be, and we are not responsible for what other players publish beyond acting on reports.'],
    },
    {
      heading: 'Changes',
      paragraphs: ['We may update these terms. If the change is important we will say so on the site.'],
    },
  ],
};

export const privacy: LegalDoc = {
  title: 'Privacy policy',
  description: 'What data Worlds Made collects and why.',
  intro: 'We collect the least we can. This page lists what, why, who helps us, and how long we keep it.',
  sections: [
    {
      heading: 'What we collect',
      bullets: [
        'If you make an account: your email, a display name (a generated nickname if you are under 18), your birth year and country, and your plan.',
        'What you make: prompts, generated games and their versions, titles, descriptions, tags, likes and reports.',
        'Daily play: scores and streaks, tied to your account or to a random anonymous id.',
        'Under-13s and signed-out players: only a random anonymous id on their device. No name, email or free text.',
      ],
    },
    {
      heading: 'Cookies and storage',
      bullets: [
        'A signed cookie that remembers your age answer.',
        'A signed cookie with your anonymous id, for streaks.',
        'Your sign-in token, kept in your browser storage.',
        'No advertising cookies for under-13s or unknown ages, and no cross-site tracking.',
      ],
    },
    {
      heading: 'Who processes data for us',
      bullets: [
        'Supabase: accounts, game data and game files.',
        'Vercel: hosting and cookie-light analytics.',
        'An AI model provider and the OpenAI Moderation service: they see prompts and game text to write and check games.',
        'Stripe: payments for the paid plan. We never see card numbers.',
        'Resend: email for the contact form and report notices.',
        'Google AdSense: ads, with personalisation turned off for children and teens.',
        'RAWG: game data for recommendations. We send it search filters, not personal data.',
        'Sentry: error reports, without personal data.',
      ],
    },
    {
      heading: 'How long we keep it',
      bullets: [
        `Anonymous ids, streaks and scores: ${LIMITS.anonRetentionDays} days after the last play.`,
        `Accounts with no activity: ${LIMITS.inactiveAccountDays} days, unless they have an active subscription.`,
        'Reports and moderation records are kept for as long as needed to enforce the rules.',
      ],
    },
    {
      heading: 'Your rights',
      paragraphs: ['Under the GDPR you can ask to see, fix, delete, restrict or move the data we hold about you, and object to how we use it. You can also complain to your data protection authority. Contact us below.'],
    },
    {
      heading: 'Children',
      paragraphs: ['We do not collect personal data from children under 13. See the For parents page for the details.'],
    },
    {
      heading: 'Contact',
      paragraphs: ['hello@worldsmade.example. Replace this with the real controller name and address before launch.'],
    },
  ],
};

export const dmca: LegalDoc = {
  title: 'Copyright and DMCA',
  description: 'How to report a game that copies your work.',
  intro: 'We respect other people\'s work. If a game on Worlds Made copies yours, tell us and we will act quickly.',
  sections: [
    {
      heading: 'How to send a notice',
      paragraphs: ['Email dmca@worldsmade.example with:'],
      bullets: [
        'The link to the game and a description of your work it copies.',
        'Your name, address, phone number and email.',
        'A statement that you believe in good faith the use is not authorised.',
        'A statement, under penalty of perjury, that the information is accurate and that you are the owner or authorised to act for them.',
        'Your signature, typed or physical.',
      ],
    },
    {
      heading: 'What we do',
      paragraphs: ['We remove or hide the reported game quickly, tell the creator, and keep a record of the notice and what we did.'],
    },
    {
      heading: 'Counter-notice',
      paragraphs: ['If your game was removed by mistake, you can send a counter-notice to the same address with your contact details, a statement under penalty of perjury that you believe the removal was a mistake, and your consent to the courts of your country. We may restore the game unless the complainant starts a legal action.'],
    },
    {
      heading: 'Repeat infringers',
      paragraphs: ['Accounts that repeatedly publish infringing games are closed.'],
    },
    {
      heading: 'Designated agent',
      paragraphs: ['Our designated agent is registered with the US Copyright Office. Add the agent\'s name and address here once registration is complete.'],
    },
  ],
};
