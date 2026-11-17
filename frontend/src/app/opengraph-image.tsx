import { ImageResponse } from 'next/og';
import { site } from '@/content/site';

export const dynamic = 'force-static';
export const alt = `${site.name}: ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Share card in the site's colours: near-black green, gold title, sage subtitle. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 96px',
          background: '#070c09',
          border: '2px solid #635028',
          color: '#e8ede5',
        }}
      >
        <div style={{ fontSize: 26, letterSpacing: 6, color: '#ecd08a' }}>AI GAME MAKER</div>
        <div style={{ marginTop: 24, fontSize: 112, fontWeight: 700, lineHeight: 1.05 }}>{site.name}</div>
        <div style={{ marginTop: 28, fontSize: 40, color: '#8ba394' }}>{site.tagline}</div>
      </div>
    ),
    size,
  );
}
