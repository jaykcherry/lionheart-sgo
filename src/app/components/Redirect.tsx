'use client';
import { useEffect, useState } from 'react';

/** The home-page thesis: the same dollars go to the Treasury or to a child's tuition. Animates once on load. */
export function Redirect() {
  const [joint, setJoint] = useState(true);
  const [on, setOn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOn(true), 900); return () => clearTimeout(t); }, []);
  const amt = joint ? 3400 : 1700;
  const fmt = (n: number) => '$' + n.toLocaleString('en-US');
  return (
    <div className="redirect">
      <div className="redirect-top">
        <p className="redirect-q">Where {fmt(amt)} of your federal tax goes</p>
        <div className="seg" role="radiogroup" aria-label="Filing status">
          <label><input type="radio" name="filing" checked={joint} onChange={() => setJoint(true)} />Married</label>
          <label><input type="radio" name="filing" checked={!joint} onChange={() => setJoint(false)} />Single</label>
        </div>
      </div>
      <button type="button" className="switch" role="switch" aria-checked={on} onClick={() => setOn(!on)}><span className="switch-track" />Give it through Lionheart</button>
      <div style={{ marginTop: 18 }}>
        <div className="dest"><div className="dest-head"><div><p className="dest-name">U.S. Treasury</p><p className="dest-sub">Paid with your tax return</p></div><p className={`dest-amt tnum${on ? ' zero' : ''}`}>{fmt(on ? 0 : amt)}</p></div>
          <div className="dest-track"><div className="dest-fill" style={{ width: on ? '0%' : '100%' }} /></div></div>
        <div className="dest"><div className="dest-head"><div><p className="dest-name">A Tennessee child’s tuition</p><p className="dest-sub">Paid to a Christian school through Lionheart</p></div><p className={`dest-amt tnum${on ? '' : ' zero'}`}>{fmt(on ? amt : 0)}</p></div>
          <div className="dest-track"><div className="dest-fill gold" style={{ width: on ? '100%' : '0%' }} /></div></div>
      </div>
      <div className="redirect-foot"><span style={{ fontWeight: 650 }}>Your total cost, either way</span><span className="v">{fmt(amt)}</span></div>
      <p className="redirect-note">Credit applies to gifts made on or after January 1, 2027, up to the federal tax you owe. Unused credit carries forward five years.</p>
    </div>
  );
}
