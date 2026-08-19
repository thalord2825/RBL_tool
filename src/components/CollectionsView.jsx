import React, { useState } from 'react';
import { Search, Star, FileText, ExternalLink, Download } from 'lucide-react';

export default function CollectionsView({ papers, collections, activeCollection, setActiveCollection }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('NEWEST');

  const filteredPapers = papers.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.title?.toLowerCase().includes(term) ||
      p.abstract?.toLowerCase().includes(term) ||
      p.authors?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex flex-1 overflow-hidden select-none font-sans text-xs">
      
      {/* COLLECTIONS SIDEBAR (Matching Image 3 Right Side Panel) */}
      <div className="w-64 bg-[#EDE9DF] border-r border-[#DCD6C5] p-4 flex flex-col justify-between shrink-0">
        <div>
          <div className="font-mono uppercase text-[10px] text-[#7A766F] tracking-widest mb-3 flex items-center justify-between">
            <span>MY COLLECTIONS ({collections.length})</span>
          </div>

          <div className="space-y-1 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
            {collections.map(col => (
              <button
                key={col.id}
                onClick={() => setActiveCollection(col.id)}
                className={`w-full text-left p-2 font-mono text-[11px] flex items-center justify-between transition-all ${
                  activeCollection === col.id
                    ? 'bg-[#F8F6F0] font-bold text-[#1A1917] border-l-4 border-[#D94E28] shadow-xs'
                    : 'hover:bg-[#E5E0D3] text-[#4A4843]'
                }`}
              >
                <span className="truncate flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: col.color }}></span>
                  {col.name}
                </span>
                <span className="text-[10px] text-[#7A766F] font-mono">{col.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Intelligence Desk Status */}
        <div className="pt-4 border-t border-[#DCD6C5] font-mono text-[10px]">
          <div className="text-[#7A766F] uppercase">INTELLIGENCE DESK</div>
          <div className="text-[#1A1917] font-bold mt-1">Pipeline Run Status:</div>
          <div className="text-[#2D7A53] font-mono font-bold mt-0.5">5,729 completed runs</div>
        </div>
      </div>

      {/* PRIORITY READING MAIN PANEL (Matching Image 3) */}
      <div className="flex-1 bg-[#F4F1EA] p-6 overflow-y-auto space-y-4">
        
        {/* Priority Reading Header */}
        <div className="flex items-center justify-between font-mono">
          <div className="flex items-center gap-4">
            <h2 className="font-bold text-sm uppercase text-[#D94E28] tracking-wider">
              PRIORITY READING
            </h2>
            <span className="text-xs text-[#7A766F]">
              {filteredPapers.length} papers
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-[#EAE6DC] border border-[#DCD6C5] px-2 py-1 text-[#4A4843]">
              SELECT PAGE (25)
            </span>
            <button className="btn-editorial-outline text-[10px] uppercase font-bold">
              SELECT ALL {filteredPapers.length}
            </button>
          </div>
        </div>

        {/* Search & Sort Controls (Matching Image 3) */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-[#7A766F]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search title or abstract..."
              className="w-full bg-[#F8F6F0] border border-[#C8C1AE] pl-9 pr-4 py-2 font-mono text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28]"
            />
          </div>

          {/* Sort & Filter Pills Bar (Matching Image 3) */}
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
            {['RELEVANCE', 'NEWEST', 'CITED', 'ALL', '>0%', '≥50%', '≥75%', '★ STARRED', 'COMPACT'].map(opt => (
              <button
                key={opt}
                onClick={() => setSortOption(opt)}
                className={`px-2.5 py-1 uppercase tracking-wider font-bold border transition-all ${
                  sortOption === opt
                    ? 'bg-[#1A1917] text-white border-[#1A1917]'
                    : 'bg-[#EAE6DC] hover:bg-[#DCD6C5] text-[#4A4843] border-[#C8C1AE]'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Papers List */}
        <div className="space-y-4 pt-2">
          {filteredPapers.map((paper, idx) => (
            <div key={paper.id || idx} className="card-editorial p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="font-mono text-sm text-[#D94E28] font-bold">{String(idx + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="font-serif text-lg font-bold text-[#1A1917] leading-snug hover:text-[#D94E28] cursor-pointer">
                      {paper.title}
                    </h3>
                    <div className="font-mono text-xs text-[#7A766F] mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-[#D94E28] font-bold">{paper.year}</span>
                      <span>•</span>
                      <span>{paper.authors}</span>
                      <span>•</span>
                      <span className="italic">{paper.venue || 'Journal'}</span>
                    </div>
                  </div>
                </div>

                {/* Score & Citation badges */}
                <div className="flex items-center gap-2 font-mono text-[10px]">
                  <span className="bg-[#FEF3C7] text-[#B8860B] border border-[#FDE68A] px-2 py-0.5 font-bold">
                    67%
                  </span>
                  <span className="bg-[#EAE6DC] text-[#4A4843] border border-[#DCD6C5] px-2 py-0.5">
                    cited {paper.citationsCount || 0}
                  </span>
                </div>
              </div>

              {/* Abstract Body */}
              <p className="font-sans text-xs text-[#4A4843] leading-relaxed line-clamp-3">
                {paper.abstract || paper.keyContribution}
              </p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
