import React from 'react';
import { Search, Sparkles, Loader2, Calendar } from 'lucide-react';

export default function SearchQueryBar({
  query,
  setQuery,
  sources,
  setSources,
  sinceYear,
  setSinceYear,
  onHarvest,
  isHarvesting
}) {
  const toggleSource = (sourceName) => {
    if (sources.includes(sourceName)) {
      if (sources.length > 1) {
        setSources(sources.filter(s => s !== sourceName));
      }
    } else {
      setSources([...sources, sourceName]);
    }
  };

  const ALL_SOURCES = ['ArXiv', 'OpenAlex', 'Semantic Scholar', 'CrossRef', 'Google Scholar'];

  return (
    <div className="bg-[#EFECE4] border-b border-[#DCD6C5] px-4 py-2 select-none shrink-0">
      <div className="flex items-center gap-3 font-mono text-xs">
        
        {/* Search Query Input */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-[#7A766F]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='("phishing" OR "scam message") AND ("few-shot" OR "LLM") AND ("PhoBERT" OR "fine-tuning")'
            className="w-full bg-[#F8F6F0] border border-[#C8C1AE] pl-8 pr-3 py-1 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28] shadow-inner"
          />
        </div>

        {/* Source Toggle Chips */}
        <div className="hidden xl:flex items-center gap-1 shrink-0">
          {ALL_SOURCES.map((src) => {
            const isSelected = sources.includes(src);
            return (
              <button
                key={src}
                type="button"
                onClick={() => toggleSource(src)}
                className={`px-2 py-0.5 text-[10px] border transition-all ${
                  isSelected
                    ? 'bg-[#1A1917] text-white border-[#1A1917] font-bold'
                    : 'bg-[#F4F1EA] text-[#7A766F] border-[#C8C1AE] hover:bg-[#EAE6DC]'
                }`}
                title={`Toggle ${src}`}
              >
                {isSelected ? '✓ ' : ''}{src}
              </button>
            );
          })}
        </div>

        {/* Year Filter */}
        <div className="flex items-center gap-1.5 shrink-0 bg-[#F8F6F0] border border-[#C8C1AE] px-2 py-0.5">
          <Calendar className="w-3 h-3 text-[#7A766F]" />
          <span className="text-[10px] text-[#7A766F] font-bold">Since:</span>
          <input
            type="number"
            value={sinceYear}
            onChange={(e) => setSinceYear(e.target.value)}
            className="w-12 bg-transparent text-center font-bold text-xs text-[#1A1917] focus:outline-none"
          />
        </div>

        {/* Harvest Metadata Button */}
        <button
          onClick={onHarvest}
          disabled={isHarvesting || !query.trim()}
          className="bg-[#D94E28] hover:bg-[#C4411C] text-white px-4 py-1 flex items-center gap-1.5 text-xs uppercase tracking-wider font-bold shadow-2xs disabled:opacity-50 shrink-0 transition-colors border border-[#A83416]"
        >
          {isHarvesting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Harvesting...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Harvest Metadata</span>
            </>
          )}
        </button>

      </div>
    </div>
  );
}
