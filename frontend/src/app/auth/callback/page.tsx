'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Notice } from '@/components/ui/Field';
import { useAuth } from '@/lib/auth';

/** Where the email sign-in link lands: the access token arrives in the URL fragment and never reaches a server. */
export default function AuthCallback() {
  const router = useRouter();
  const { acceptToken } = useAuth();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('access_token');
    // Remove the token from the address bar and history straight away.
    window.history.replaceState(null, '', window.location.pathname);
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFailed(true);
      return;
    }
    void acceptToken(token).then(() => router.replace('/login'));
  }, [acceptToken, router]);

  return (
    <div className="mx-auto max-w-[460px] px-5 py-20">
      {failed ? <Notice tone="error">That sign-in link is not valid or has expired. Please request a new one.</Notice> : <Notice>Signing you in…</Notice>}
    </div>
  );
}
