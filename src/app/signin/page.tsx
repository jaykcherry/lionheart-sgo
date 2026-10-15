import { sendMagicLink } from './actions';

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; sent?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="band band-gilt">
      <section className="wrap split" style={{ paddingBlock: '72px 84px' }}>
        <div className="stack-m">
          <span className="eyebrow">Sign in</span>
          <h1 className="display-sm">One account for families, schools and donors.</h1>
          <p className="lead">No passwords. We email you a sign-in link. School staff and board members also confirm with a second factor.</p>
        </div>
        <form action={sendMagicLink} className="panel stack-m" style={{ maxWidth: 460 }}>
          {sp.sent && <p className="notice notice-ok">Check your email for a sign-in link. It expires in one hour.</p>}
          {sp.error && <p className="notice notice-bad">{sp.error}</p>}
          <input type="hidden" name="next" value={sp.next ?? '/onboarding'} />
          <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" required autoComplete="email" /></div>
          <button className="btn btn-solid" type="submit">Email me a sign-in link</button>
        </form>
      </section>
    </div>
  );
}
