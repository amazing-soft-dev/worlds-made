import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AccountView } from '@/components/account/AccountView';
import { SectionTitle } from '@/components/ui/SectionTitle';

export const metadata: Metadata = {
  title: 'My account',
  robots: { index: false },
};

export default function AccountPage() {
  return (
    <div className="px-5 py-16 tablet:px-10">
      <div className="mx-auto flex max-w-[820px] flex-col gap-12">
        <SectionTitle as="h1" eyebrow="Your corner" title="My account" />
        <Suspense fallback={<p className="text-copy text-envy">Loading…</p>}>
          <AccountView />
        </Suspense>
      </div>
    </div>
  );
}
