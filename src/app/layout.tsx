import type { Metadata } from 'next';
import Link from 'next/link';
import localFont from 'next/font/local';
import './globals.css';

// Self-hosted variable fonts (latin subset): no third-party font requests from the portals.
const cormorant = localFont({ src: './fonts/cormorant-garamond-latin.woff2', weight: '300 700', variable: '--font-cormorant', display: 'swap' });
const lora = localFont({ src: './fonts/lora-latin.woff2', weight: '400 700', variable: '--font-lora', display: 'swap' });

export const metadata: Metadata = {
  title: 'Lionheart — Scholarships for Christian education',
  description: 'A Tennessee scholarship granting organization under the federal education scholarship tax credit.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${lora.variable}`}>
      <body>
        <header className="band band-gilt" style={{ borderBottom: 0 }}>
          <div className="wrap">
            <nav className="nav" aria-label="Main">
              <Link href="/" className="brand" aria-label="Lionheart SGO, home">
                <span className="brand-mark">L<span>H</span></span>
                <span className="brand-words"><span className="brand-name">LIONHEART</span><span className="brand-sub">SCHOLARSHIP GRANTING ORGANIZATION</span></span>
              </Link>
              <div className="nav-links">
                <Link href="/donors">Donors</Link>
                <Link href="/families">Families</Link>
                <Link href="/schools">Schools</Link>
                <Link href="/signin">Sign in</Link>
                <Link href="/donor/give" className="btn btn-primary">Make a gift</Link>
              </div>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="band band-ink">
          <div className="wrap footer">
            <span><span style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: 'var(--color-bg)' }}>Lionheart</span> · A Tennessee scholarship granting organization</span>
            <span>A 501(c)(3) nonprofit · EIN {process.env.SGO_EIN ?? '[XX-XXXXXXX]'}</span>
            <span>Tax information is general guidance. Consult your tax advisor.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
