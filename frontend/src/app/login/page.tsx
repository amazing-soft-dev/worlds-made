import type { Metadata } from 'next';
import { LoginFlow } from '@/components/auth/LoginFlow';
import { Photo } from '@/components/Photo';
import { SectionTitle } from '@/components/ui/SectionTitle';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to build games, like games and keep your daily streak.',
};

export default function LoginPage() {
  return (
    <div className="px-5 py-16 tablet:px-10">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-12 desktop:flex-row desktop:items-start desktop:gap-16">
        <div className="flex flex-1 flex-col gap-8">
          <SectionTitle as="h1" eyebrow="Welcome" title="Sign in" description="You only need an account to build, like and keep a streak. Playing is open to everyone." className="mx-0 items-start text-left" />
          <LoginFlow />
        </div>
        <div className="relative hidden aspect-[3/4] w-[420px] flex-none border border-line desktop:block">
          <Photo slot="story" sizes="420px" />
        </div>
      </div>
    </div>
  );
}
