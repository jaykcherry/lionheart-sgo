'use client';
import { useEffect, useRef } from 'react';
import { byLabel, bySlug } from '@/web/heritage';
import * as kit from './kit';

/** Resources toolkit: school-personalized print pieces, social graphics, QR codes and copy. Same renderer as the prototype. */
export function ResourcesClient({ school, limit4 }: { school?: string; limit4: number }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current; if (!el) return;
    kit.setLimit4(limit4);
    kit.S.res.school = bySlug(school)?.id ?? '';
    const toast = (msg: string) => { let t = document.getElementById('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); } t.textContent = msg; t.hidden = false; setTimeout(() => { t!.hidden = true; }, 2400); };
    const render = (animate: boolean) => {
      el.innerHTML = kit.resourcesHTML();
      window.LHMotion?.mount(el, { animate, route: 'resources' });
      kit.fitMats(); kit.drawAllSocial();
      const sid = kit.S.res.school; const url = new URL(location.href); if (sid) url.searchParams.set('school', sid); else url.searchParams.delete('school'); history.replaceState(null, '', url);
    };
    const onInput = (e: Event) => { const t = e.target as HTMLInputElement; if (t.dataset.actionInput !== 'res-school') return; const sc = byLabel(t.value); if (sc && sc.id !== kit.S.res.school) { kit.S.res.school = sc.id; render(false); } };
    const copy = (text: string) => { try { navigator.clipboard.writeText(text).then(() => toast('Copied'), () => toast('Select the text and copy it')); } catch { toast('Select the text and copy it'); } };
    const onClick = (e: MouseEvent) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-action]'); if (!b) return;
      const a = b.dataset.action, c = kit.resCtx();
      if (a === 'res-clear') { kit.S.res.school = ''; render(false); }
      if (a === 'res-print') kit.printMat(b.dataset.kind);
      if (a === 'res-png') { const cv = el.querySelector<HTMLCanvasElement>(`canvas[data-social="${b.dataset.kind}"]`); cv?.toBlob((bl) => bl && kit.downloadBlob(bl, `lionheart-${b.dataset.kind}-${kit.fileSlug()}.png`)); }
      if (a === 'res-qr') {
        const u = b.dataset.kind === 'give' ? c.give : c.apply, name = `lionheart-qr-${b.dataset.kind}-${kit.fileSlug()}`;
        if (b.dataset.fmt === 'svg') { kit.downloadBlob(new Blob([kit.qrSvg(u, 600, undefined)], { type: 'image/svg+xml' }), name + '.svg'); return; }
        const q = kit.qrMatrix(u), n = q.getModuleCount(), cell = 20, size = (n + 8) * cell, cv = document.createElement('canvas'); cv.width = cv.height = size;
        const x = cv.getContext('2d')!; x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); x.fillStyle = '#111a30';
        for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (q.isDark(r, col)) x.fillRect((col + 4) * cell, (r + 4) * cell, cell, cell);
        cv.toBlob((bl) => bl && kit.downloadBlob(bl, name + '.png'));
      }
      if (a === 'copy') copy(b.dataset.text ?? '');
      if (a === 'copy-block') copy(document.getElementById('copy-' + b.dataset.i)?.textContent ?? '');
    };
    const onResize = () => kit.fitMats();
    el.addEventListener('input', onInput); el.addEventListener('click', onClick); window.addEventListener('resize', onResize);
    render(true);
    return () => { el.removeEventListener('input', onInput); el.removeEventListener('click', onClick); window.removeEventListener('resize', onResize); };
  }, [school, limit4]);
  return <div ref={root} />;
}
