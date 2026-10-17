import type { Metadata } from 'next';
import Link from 'next/link';
import localFont from 'next/font/local';
import { Mark } from './components/Mark';
import './globals.css';

// Archivo, self-hosted, with both weight and width axes (display type uses the expanded widths).
const archivo = localFont({
  src: './fonts/archivo-wdth.woff2', weight: '100 900', variable: '--font-archivo', display: 'swap',
  declarations: [{ prop: 'font-stretch', value: '62% 125%' }],
});

export const metadata: Metadata = {
  title: 'Lionheart — Scholarships for Tennessee Christian schools',
  description: 'Give up to $1,700 each and take it off your federal tax bill. Your gift becomes a scholarship at a Tennessee Christian school.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>
        <header className="site-head band">
          <div className="wrap">
            <nav className="nav" aria-label="Main">
              <Link href="/" className="brand" aria-label="Lionheart, home">
                <Mark />
                <span><span className="brand-name">Lionheart</span><span className="brand-sub">Scholarships for Tennessee Christian schools</span></span>
              </Link>
              <Link href="/donor/give" className="btn btn-gold btn-sm nav-give-mobile">Give</Link>
              <div className="nav-links">
                <Link href="/donors">Donors</Link>
                <Link href="/families">Families</Link>
                <Link href="/schools">Schools</Link>
                <Link href="/signin">Sign in</Link>
                <Link href="/donor/give" className="btn btn-gold">Give $3,400</Link>
              </div>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="band band-ink">
          <div className="wrap footer">
            <div><Link href="/" className="brand" style={{ marginBottom: 14 }}><Mark /><span className="brand-name">Lionheart</span></Link>
              <p>A Tennessee scholarship granting organization under the federal education scholarship tax credit.</p></div>
            <div><strong>Contact</strong>hello@lionheartscholars.org<br />Nashville, Tennessee</div>
            <div><strong>Organization</strong>501(c)(3) public charity<br />EIN {process.env.SGO_EIN ?? '[XX-XXXXXXX]'}</div>
            <div><strong>Please note</strong>Tax information here is general guidance, not tax advice. Talk with your tax preparer.</div>
          </div>
        </footer>
      </body>
    </html>
  );
}
