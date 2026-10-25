import React, { useState } from 'react';
import { JARGON_DICTIONARY, JargonItem } from '../data/jargon.js';
import { BookOpen, X, Search, HelpCircle, ArrowRight } from 'lucide-react';

interface JargonModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTerm?: string;
}

export const JargonModal: React.FC<JargonModalProps> = ({ isOpen, onClose, initialTerm }) => {
  const [searchTerm, setSearchTerm] = useState(initialTerm || '');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  if (!isOpen) return null;

  const categories = ['All', 'Equities', 'Bonds & Rates', 'Currencies & Commodities', 'General'];

  const items: JargonItem[] = Object.values(JARGON_DICTIONARY).filter((item) => {
    const matchesCat = activeCategory === 'All' || item.category === activeCategory;
    const matchesSearch =
      !searchTerm ||
      item.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.definition.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.plainEnglishExample.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="jargon-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
    >
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-xl">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 id="jargon-modal-title" className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Market Jargon Buster
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Plain-English explanations for everyday investors
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Jargon Buster dialog"
            className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Categories */}
        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search terms (e.g., yield, VIX, risk-on, basis points)..."
              value={searchTerm}
              onChange={(e: any) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-100 dark:bg-neutral-800 border-0 rounded-xl text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                  activeCategory === cat
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">
              <HelpCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No financial term matched your search.</p>
              <p className="text-xs text-neutral-400 mt-1">Try searching for &quot;yield&quot;, &quot;VIX&quot;, or &quot;rates&quot;.</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.term}
                className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 hover:border-blue-200 dark:hover:border-blue-800/60 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                    {item.term}
                  </h3>
                  <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                    {item.category}
                  </span>
                </div>
                <p className="text-xs text-neutral-700 dark:text-neutral-300 mb-2 leading-relaxed">
                  {item.definition}
                </p>
                <div className="p-2.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 flex items-start gap-2">
                  <ArrowRight className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-normal">
                    <strong className="text-neutral-800 dark:text-neutral-200 font-medium">Real-World Meaning: </strong>
                    {item.plainEnglishExample}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/40 flex justify-between items-center text-xs text-neutral-500">
          <span>Showing {items.length} simplified concepts</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 font-medium bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
