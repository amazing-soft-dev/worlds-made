import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';
import { dmca } from '@/content/legal';

export const metadata: Metadata = { title: dmca.title, description: dmca.description };

export default function DmcaPage() {
  return <LegalPage doc={dmca} />;
}
