'use client';
import { useEffect } from 'react';
import { certCard } from '@/web/heritage';

/** Home page: the certificate's filing toggle re-issues the certificate and the journey amounts. */
export function HomeEnhance() {
  useEffect(() => {
    const onChange = (e: Event) => {
      const t = e.target as HTMLInputElement;
      if (t.name !== 'home-filing') return;
      const joint = t.value === 'joint', amt = joint ? 3400 : 1700;
      const cert = document.getElementById('cert');
      if (cert) { cert.innerHTML = certCard(joint); window.LHMotion?.refresh(cert, true); }
      const b = document.getElementById('hero-give');
      if (b) b.innerHTML = (joint ? 'Give $3,400 as a couple' : 'Give $1,700') + ' <span class="arr" aria-hidden="true">→</span>';
      const j = document.querySelector<HTMLElement>('[data-journey]');
      if (j) { j.dataset.full = String(amt); j.querySelectorAll('[data-money]').forEach((m) => { m.textContent = '$' + amt.toLocaleString('en-US'); }); window.LHMotion?.journeyRefresh(true); }
    };
    document.addEventListener('change', onChange);
    return () => document.removeEventListener('change', onChange);
  }, []);
  return null;
}
