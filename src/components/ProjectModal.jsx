import React, { useState } from 'react';
import { X, Save, Check, Database, Filter } from 'lucide-react';

export default function ProjectModal({ isOpen, onClose, onSaveRule, activeProject }) {
  const [query, setQuery] = useState(
    '("phishing" OR "smishing" OR "scam message" OR "SMS spam") AND ("few-shot" OR "prompt-based" OR "LLM") AND ("fine-tuning" OR "PhoBERT" OR "BERT")'
  );
  const [sources, setSources] = useState({
    OpenAlex: true,
    SemanticScholar: true,
    ArXiv: true,
    DBLP: false,
    GoogleScholarAlerts: true
  });
  const [sinceYear, setSinceYear] = useState(2020);

  if (!isOpen) return null;

  const handleSourceToggle = (sourceKey) => {
    setSources(prev => ({
      ...prev,
      [sourceKey]: !prev[sourceKey]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveRule({
      query,
      sources: Object.keys(sources).filter(k => sources[k]),
      sinceYear: parseInt(sinceYear, 10)
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none">
      <div className="bg-[#F4F1EA] border-2 border-[#1A1917] max-w-3xl w-full shadow-[8px_8px_0px_0px_rgba(26,25,23,0.8)] overflow-hidden">
        {/* Header Banner (Matching Image 1 & 2) */}
        <div className="bg-[#EDE9DF] px-6 py-3 border-b border-[#DCD6C5] flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] text-[#7A766F] uppercase tracking-widest">
              DATA SOURCES • TAXONOMY
            </div>
            <h2 className="font-serif text-2xl font-bold text-[#1A1917]">
              Capstone projects
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-[#DCD6C5] text-[#1A1917] transition-colors border border-[#C8C1AE]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Banner */}
        <div className="bg-[#EFECE4] px-6 py-2 border-b border-[#DCD6C5] font-mono text-[11px] text-[#D94E28] uppercase font-bold tracking-wider">
          ONE PROJECT = ONE CAPSTONE SUBCATEGORY. Save the project first, then add one or more search rules that feed papers into it.
        </div>

        {/* Modal Form Content (Matching Image 1 & 2 UI) */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="border border-[#DCD6C5] bg-[#F8F6F0] p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#E2DEC9] pb-3">
              <h3 className="font-mono uppercase font-bold text-sm tracking-wider text-[#1A1917]">
                EDIT SEARCH RULE
              </h3>
              <button 
                type="button" 
                onClick={onClose}
                className="font-mono text-xs uppercase text-[#7A766F] hover:text-[#D94E28]"
              >
                CANCEL
              </button>
            </div>

            {/* SEARCH QUERY INPUT */}
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-[#1A1917] font-bold mb-2">
                SEARCH QUERY
              </label>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                rows={3}
                className="w-full bg-[#F4F1EA] border border-[#C8C1AE] p-3 font-mono text-xs text-[#1A1917] focus:border-[#D94E28] focus:outline-none leading-relaxed shadow-inner"
                placeholder='("search phrase 1" OR "phrase 2") AND ("keyword 1" OR "keyword 2")'
              />
            </div>

            {/* SOURCES CHECKBOXES (Matching Image 1 Grid) */}
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-[#1A1917] font-bold mb-2">
                SOURCES
              </label>
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                {/* OpenAlex */}
                <label 
                  onClick={() => handleSourceToggle('OpenAlex')}
                  className={`p-3 border flex items-center gap-2 cursor-pointer transition-all ${
                    sources.OpenAlex 
                      ? 'bg-[#F4F1EA] border-[#D94E28] text-[#1A1917] font-bold shadow-xs' 
                      : 'bg-[#EDE9DF] border-[#DCD6C5] text-[#7A766F]'
                  }`}
                >
                  <input 
                    type="checkbox" 
                    checked={sources.OpenAlex} 
                    onChange={() => {}} 
                    className="accent-[#D94E28]"
                  />
                  <span>OpenAlex</span>
                </label>

                {/* Semantic Scholar */}
                <label 
                  onClick={() => handleSourceToggle('SemanticScholar')}
                  className={`p-3 border flex items-center gap-2 cursor-pointer transition-all ${
                    sources.SemanticScholar 
                      ? 'bg-[#F4F1EA] border-[#D94E28] text-[#1A1917] font-bold shadow-xs' 
                      : 'bg-[#EDE9DF] border-[#DCD6C5] text-[#7A766F]'
                  }`}
                >
                  <input 
                    type="checkbox" 
                    checked={sources.SemanticScholar} 
                    onChange={() => {}} 
                    className="accent-[#D94E28]"
                  />
                  <span>Semantic Scholar</span>
                </label>

                {/* ArXiv */}
                <label 
                  onClick={() => handleSourceToggle('ArXiv')}
                  className={`p-3 border flex items-center gap-2 cursor-pointer transition-all ${
                    sources.ArXiv 
                      ? 'bg-[#F4F1EA] border-[#D94E28] text-[#1A1917] font-bold shadow-xs' 
                      : 'bg-[#EDE9DF] border-[#DCD6C5] text-[#7A766F]'
                  }`}
                >
                  <input 
                    type="checkbox" 
                    checked={sources.ArXiv} 
                    onChange={() => {}} 
                    className="accent-[#D94E28]"
                  />
                  <span>ArXiv</span>
                </label>

                {/* DBLP */}
                <label 
                  onClick={() => handleSourceToggle('DBLP')}
                  className={`p-3 border flex items-center gap-2 cursor-pointer transition-all ${
                    sources.DBLP 
                      ? 'bg-[#F4F1EA] border-[#D94E28] text-[#1A1917] font-bold shadow-xs' 
                      : 'bg-[#EDE9DF] border-[#DCD6C5] text-[#7A766F]'
                  }`}
                >
                  <input 
                    type="checkbox" 
                    checked={sources.DBLP} 
                    onChange={() => {}} 
                    className="accent-[#D94E28]"
                  />
                  <span>DBLP</span>
                </label>
              </div>

              {/* Google Scholar Alerts Option */}
              <div className="mt-3">
                <label 
                  onClick={() => handleSourceToggle('GoogleScholarAlerts')}
                  className={`p-3 border flex items-start gap-2 cursor-pointer transition-all ${
                    sources.GoogleScholarAlerts 
                      ? 'bg-[#F4F1EA] border-[#D94E28] text-[#1A1917]' 
                      : 'bg-[#EDE9DF] border-[#DCD6C5] text-[#7A766F]'
                  }`}
                >
                  <input 
                    type="checkbox" 
                    checked={sources.GoogleScholarAlerts} 
                    onChange={() => {}} 
                    className="accent-[#D94E28] mt-0.5"
                  />
                  <div>
                    <div className="font-mono text-xs font-bold">Google Scholar Alerts</div>
                    <div className="font-mono text-[10px] text-[#7A766F]">via connected Gmail</div>
                  </div>
                </label>
              </div>
              <p className="font-mono text-[10px] text-[#7A766F] mt-1.5 italic">
                Direct sources are searched by API; Google Scholar Alerts are read through the connected Gmail account.
              </p>
            </div>

            {/* COLLECT PAPERS SINCE */}
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-[#1A1917] font-bold mb-2">
                COLLECT PAPERS SINCE
              </label>
              <input
                type="number"
                value={sinceYear}
                onChange={(e) => setSinceYear(e.target.value)}
                className="w-full bg-[#F4F1EA] border border-[#C8C1AE] p-3 font-mono text-sm text-[#1A1917] focus:border-[#D94E28] focus:outline-none"
                placeholder="2020"
              />
            </div>
          </div>

          {/* SAVE BUTTON */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-editorial-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-editorial bg-[#D94E28] hover:bg-[#C4411C] py-3 px-8 text-sm font-bold flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>SAVE RULE</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
