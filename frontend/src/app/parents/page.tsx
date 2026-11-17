import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { Photo } from '@/components/Photo';
import { parents } from '@/content/legal';

export const metadata: Metadata = { title: parents.title, description: parents.description };

export default function ParentsPage() {
  return (
    <LegalPage
      doc={parents}
      aside={
        <div className="relative h-[180px] border border-line tablet:h-[240px]">
          <Photo slot="parents" sizes="(min-width: 1200px) 820px, 100vw" />
        </div>
      }
    />
  );
}
