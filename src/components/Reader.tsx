import React, { createContext, useContext, useEffect, useState } from 'react';
import type { TwoLevel } from '../types/report.js';

export type Voice = 'plain' | 'both' | 'technical';
const KEY = 'gmi_voice';
const Ctx = createContext<{ voice: Voice; setVoice: (v: Voice) => void }>({ voice: 'both', setVoice: () => undefined });
export const useVoice = () => useContext(Ctx);

export const ReaderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [voice, setVoice] = useState<Voice>('plain');
  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v === 'plain' || v === 'both' || v === 'technical') setVoice(v);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const set = (v: Voice) => {
    setVoice(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* ignore */
    }
  };
  return <Ctx.Provider value={{ voice, setVoice: set }}>{children}</Ctx.Provider>;
};

const OPTIONS: Array<{ v: Voice; label: string; hint: string }> = [
  { v: 'plain', label: 'Plain English', hint: 'Short sentences, no jargon' },
  { v: 'both', label: 'Both', hint: 'Plain English and technical side by side' },
  { v: 'technical', label: 'Technical', hint: 'Market terms and detail' },
];

/** Segmented control that sets how every explanation on the page is shown. */
export const VoiceToggle: React.FC = () => {
  const { voice, setVoice } = useVoice();
  return (
    <div role="radiogroup" aria-label="Reading style" className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 p-0.5 text-xs">
      {OPTIONS.map((o) => (
        <button
          key={o.v}
          role="radio"
          aria-checked={voice === o.v}
          title={o.hint}
          onClick={() => setVoice(o.v)}
          className={`px-2.5 py-1 rounded-md font-medium ${voice === o.v ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-900 dark:text-white' : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
};

/** One explanation shown in the voice the reader chose. */
export const Say: React.FC<{ t: TwoLevel; big?: boolean }> = ({ t, big }) => {
  const { voice } = useVoice();
  const main = voice === 'technical' ? t.technical : t.layman;
  const second = voice === 'both' ? t.technical : null;
  return (
    <>
      <p className={big ? 'prose-brief text-2xl sm:text-3xl font-semibold leading-snug tracking-tight max-w-[34ch] sm:max-w-[40ch]' : 'text-sm leading-relaxed'}>{main}</p>
      {second && <p className={`${big ? 'text-sm mt-3 max-w-[70ch]' : 'text-sm mt-1.5'} leading-relaxed text-neutral-600 dark:text-neutral-400`}>{second}</p>}
    </>
  );
};
