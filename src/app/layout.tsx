import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { MotionMount } from './components/MotionMount';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lionheart — Scholarships for Tennessee Christian schools',
  description: 'Give up to $1,700 each ($3,400 as a couple) and claim it back as a federal tax credit. Your gift becomes tuition at a Tennessee Christian school.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lionheartscholars.org'),
};
export const viewport: Viewport = { themeColor: '#1c2a4a' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="topbar band"><div className="wrap"><span>A Tennessee scholarship granting organization under the federal scholarship tax credit</span><span className="topbar-links"><Link href="/#about">About</Link><Link href="/signin">Sign in</Link></span></div></div>
        <header className="site-head band">
          <div className="wrap">
            <nav className="nav" aria-label="Main">
              <div className="nav-left nav-links">
                <Link href="/donors">Donors</Link>
                <Link href="/families">Families</Link>
                <Link href="/schools">Schools</Link>
                <Link href="/resources">Resources</Link>
              </div>
              <Link href="/" className="brand" aria-label="Lionheart, home">
                <span className="brand-loc">Tennessee</span>
                <span className="brand-word"><i /><span className="brand-name">LIONHEART</span><i /></span>
              </Link>
              <div className="nav-right">
                <Link href="/signin?next=/onboarding">Apply</Link>
                <Link href="/donor/give" className="btn btn-crimson btn-sm">Make a gift</Link>
              </div>
            </nav>
          </div>
          <div className="wrap head-rule" />
          <span className="scroll-meter" aria-hidden="true" />
        </header>
        <main id="app">{children}</main>
        <footer className="band site-foot">
          <div className="wrap wave" />
          <div className="wrap footer">
            <div><p className="foot-word">LIONHEART</p><p style={{ marginTop: 12 }}>A Tennessee scholarship granting organization under the federal scholarship tax credit.</p></div>
            <div><strong>Contact</strong>hello@lionheartscholars.org<br />Tennessee</div>
            <div><strong>Organization</strong>501(c)(3) public charity<br />EIN {process.env.SGO_EIN ?? '[XX-XXXXXXX]'}</div>
            <div><strong>Please note</strong>Tax information here is general guidance, not tax advice. Talk with your tax preparer.</div>
          </div>
        </footer>
        <Script src="/motion.js" strategy="afterInteractive" />
        <MotionMount />
      </body>
    </html>
  );
}
