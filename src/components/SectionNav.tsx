import React, { useEffect, useState } from 'react';

const ITEMS = [
  { id: 'today', label: 'Today' },
  { id: 'markets', label: 'Markets' },
  { id: 'next', label: 'What next' },
  { id: 'why', label: 'Why it moved' },
  { id: 'economy', label: 'Economy' },
  { id: 'companies', label: 'Companies' },
  { id: 'news', label: 'News' },
  { id: 'method', label: 'How it works' },
];

/** Sticky section tabs that follow the reader's position on the page. */
export const SectionNav: React.FC = () => {
  const [active, setActive] = useState('today');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const first = ITEMS.find((i) => seen.get(i.id));
        if (first) setActive(first.id);
      },
      { rootMargin: '-120px 0px -55% 0px' }
    );
    for (const i of ITEMS) {
      const el = document.getElementById(i.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);
  return (
    <nav aria-label="Sections" className="sticky top-14 z-30 bg-white/95 dark:bg-neutral-900/95 backdrop-blur border-b border-neutral-200 dark:border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-1 overflow-x-auto text-sm">
        {ITEMS.map((i) => (
          <a
            key={i.id}
            href={`#${i.id}`}
            aria-current={active === i.id ? 'true' : undefined}
            className={`px-3 py-2.5 whitespace-nowrap border-b-2 ${active === i.id ? 'border-indigo-600 text-neutral-900 dark:text-white font-semibold' : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'}`}
          >
            {i.label}
          </a>
        ))}
      </div>
    </nav>
  );
};
