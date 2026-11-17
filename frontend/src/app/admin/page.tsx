import type { Metadata } from 'next';
import { AdminView } from '@/components/admin/AdminView';
import { SectionTitle } from '@/components/ui/SectionTitle';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <div className="px-5 py-16 tablet:px-10">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-12">
        <SectionTitle as="h1" eyebrow="Founder only" title="Admin" />
        <AdminView />
      </div>
    </div>
  );
}
