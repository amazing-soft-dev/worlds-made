import { StateMessage } from '@/components/ui/StateMessage';

export default function NotFound() {
  return (
    <StateMessage title="This page wandered off" action={{ label: 'back home', href: '/' }} secondary={{ label: 'play the gallery', href: '/gallery' }}>
      <p>The page you are looking for does not exist or has moved. Let&apos;s get you back to something to play.</p>
    </StateMessage>
  );
}
