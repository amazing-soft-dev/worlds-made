'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';

/** "Sign in" for visitors, "Account" once there is a profile. */
export function AuthLink({ className }: { className?: string }) {
  const { status } = useAuth();
  const signedIn = status === 'ready';
  return (
    <Link href={signedIn ? '/account' : '/login'} className={className}>
      {signedIn ? 'Account' : 'Sign in'}
    </Link>
  );
}
