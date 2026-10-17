'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

type Motion = { mount: (root: Element, o: { animate: boolean; route: string }) => void; refresh: (el: Element, anim: boolean) => void; journeyRefresh: (force?: boolean) => void };
declare global { interface Window { LHMotion?: Motion } }

/** Runs the shared motion layer (public/motion.js) after every navigation, and marks the current nav link. */
export function MotionMount() {
  const path = usePathname();
  useEffect(() => {
    let tries = 0, t: ReturnType<typeof setTimeout>;
    const route = path === '/' ? 'home' : path.split('/')[1] ?? '';
    const run = () => {
      const root = document.getElementById('app');
      if (window.LHMotion && root) window.LHMotion.mount(root, { animate: true, route });
      else if (tries++ < 40) t = setTimeout(run, 50);
    };
    run();
    document.querySelectorAll<HTMLAnchorElement>('.nav a:not(.btn), .topbar a').forEach((a) => {
      const href = a.getAttribute('href') ?? '';
      if (href !== '/' && path.startsWith(href.split('?')[0]!)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    return () => clearTimeout(t);
  }, [path]);
  return null;
}
