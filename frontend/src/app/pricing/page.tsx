import type { Metadata } from 'next';
import { Photo } from '@/components/Photo';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { site } from '@/content/site';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Free to start. A paid Maker plan for adults who build a lot.',
};

export default function PricingPage() {
  return (
    <div className="px-5 py-16 tablet:px-10">
      <div className="mx-auto max-w-[1080px]">
        <SectionTitle
          as="h1"
          eyebrow="Plans"
          title="Free to start"
          description="Playing is always free. Building has a small daily allowance, because every build costs real money."
        />
        <div className="relative mt-12 h-[200px] border border-line tablet:h-[260px]">
          <Photo slot="pricing" sizes="(min-width: 1200px) 1080px, 100vw" />
        </div>

        <div className="mt-10 grid gap-5 tablet:grid-cols-2">
          {site.plans.map((plan) => (
            <Card key={plan.id} className="flex flex-col gap-5 p-8">
              <div>
                <h2 className="font-display text-h3">{plan.name}</h2>
                <p className="mt-1 text-copy text-envy">{plan.blurb}</p>
              </div>
              <p className="font-display text-lead text-gold">{plan.price}</p>
              <ul className="flex flex-1 flex-col gap-2 text-copy">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-3">
                    <span aria-hidden className="text-gold">
                      ✦
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <div>
                <Button href={plan.cta.href} variant={plan.id === 'free' ? 'primary' : 'ghost'}>
                  {plan.cta.label}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-[700px] text-center text-base text-envy">
          Allowances shown are examples and will be tuned once real build costs are measured. The paid plan is for adults only: if you
          are under 18, ask a parent to sign up on their own account. Payments are handled by Stripe, so we never see card details.
        </p>
      </div>
    </div>
  );
}
