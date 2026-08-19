import React, { useState } from 'react';
import { 
  Search, 
  Sparkles, 
  Loader2, 
  Calendar, 
  BrainCircuit, 
  ChevronDown, 
  ChevronUp, 
  Bot, 
  Download,
  Info,
  CheckCircle2
} from 'lucide-react';

export default function SearchQueryBar({
  query,
  setQuery,
  sources,
  setSources,
  sinceYear,
  setSinceYear,
  researchContext,
  setResearchContext,
  autoScreenModel,
  setAutoScreenModel,
  discardExcludedOnHarvest,
  setDiscardExcludedOnHarvest,
  onHarvest,
  isHarvesting
}) {
  const [showContextDrawer, setShowContextDrawer] = useState(false);

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

  const CONTEXT_PRESETS = [
    {
      label: '🇻🇳 Vietnam-First (Global Fallback)',
      text: 'Prioritize Vietnamese SMS/Zalo/Messenger phishing and scam datasets. If scarce, accept Southeast Asian and international mobile phishing studies with transferable NLP/LLM classification architectures (relax strict Vietnam-only constraint).'
    },
    {
      label: '🤖 LLM Prompting & Few-Shot Focus',
      text: 'Focus on prompt engineering, In-Context Learning (Zero-shot, Few-shot), and LLMs compared against fine-tuned PLMs (PhoBERT, BERT) for spam/scam text classification.'
    },
    {
      label: '📊 Empirical Metrics & Datasets Only',
      text: 'Require concrete empirical results (Accuracy, Precision, Recall, Macro-F1, Latency, Token Cost) and accessible experimental datasets. Strictly exclude purely conceptual or survey papers.'
    }
  ];

  return (
    <div className="bg-[#EFECE4] border-b border-[#DCD6C5] px-4 py-2 select-none shrink-0 space-y-2 font-mono text-xs">
      
      {/* Primary Toolbar Row */}
      <div className="flex items-center gap-2.5 flex-wrap">
        
        {/* Search Query Input */}
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-[#7A766F]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='("phishing" OR "scam message") AND ("few-shot" OR "LLM") AND ("PhoBERT" OR "fine-tuning")'
            className="w-full bg-[#F8F6F0] border border-[#C8C1AE] pl-8 pr-3 py-1 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28] shadow-inner rounded-xs"
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
                className={`px-2 py-0.5 text-[10px] border transition-all rounded-xs cursor-pointer ${
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
        <div className="flex items-center gap-1.5 shrink-0 bg-[#F8F6F0] border border-[#C8C1AE] px-2 py-0.5 rounded-xs">
          <Calendar className="w-3 h-3 text-[#7A766F]" />
          <span className="text-[10px] text-[#7A766F] font-bold">Since:</span>
          <input
            type="number"
            value={sinceYear}
            onChange={(e) => setSinceYear(e.target.value)}
            className="w-12 bg-transparent text-center font-bold text-xs text-[#1A1917] focus:outline-none"
          />
        </div>

        {/* AI Context Guidance Drawer Toggle */}
        <button
          type="button"
          onClick={() => setShowContextDrawer(!showContextDrawer)}
          className={`px-2.5 py-1 text-[11px] font-bold border rounded-xs flex items-center gap-1.5 transition-all cursor-pointer ${
            showContextDrawer || (researchContext && researchContext.trim())
              ? 'bg-[#24221F] text-[#FDE68A] border-[#1A1917] shadow-2xs'
              : 'bg-[#F8F6F0] text-[#55524B] border-[#C8C1AE] hover:bg-[#EDE9DF]'
          }`}
          title="Customize AI Context Guidance and PICO relaxation notes"
        >
          <BrainCircuit className="w-3.5 h-3.5 text-[#EAB308]" />
          <span>AI Guidance</span>
          {showContextDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3 text-[#A09B8E]" />}
        </button>

        {/* DUAL HARVEST BUTTONS: Standard vs AI Screen */}
        <div className="flex items-center gap-1.5 shrink-0">
          
          {/* Button 1: Standard Crawl */}
          <button
            type="button"
            onClick={() => onHarvest(false)}
            disabled={isHarvesting || !query.trim()}
            className="bg-[#24221F] hover:bg-[#33312E] text-[#F4F1EA] px-3 py-1 flex items-center gap-1.5 text-xs font-bold shadow-2xs disabled:opacity-50 transition-all border border-[#1A1917] cursor-pointer rounded-xs"
            title="Fast multi-source metadata harvest without AI screening (saved as PENDING)"
          >
            {isHarvesting ? (
              <Loader2 className="w-3 h-3 animate-spin text-[#A09B8E]" />
            ) : (
              <Download className="w-3 h-3 text-[#A09B8E]" />
            )}
            <span>Standard Crawl</span>
          </button>

          {/* Button 2: Crawl + AI Screen */}
          <button
            type="button"
            onClick={() => onHarvest(true)}
            disabled={isHarvesting || !query.trim()}
            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white px-3.5 py-1 flex items-center gap-1.5 text-xs uppercase tracking-wider font-bold shadow-2xs disabled:opacity-50 transition-all border border-[#3730A3] cursor-pointer rounded-xs"
            title="Crawl and immediately evaluate papers with Gemini AI using PICO + IC/EC + Context"
          >
            {isHarvesting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Screening...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Crawl + AI Screen ⚡</span>
              </>
            )}
          </button>

        </div>

      </div>

      {/* Expandable AI Context Guidance & Screening Configuration Drawer */}
      {showContextDrawer && (
        <div className="bg-[#F8F6F0] border border-[#DCD6C5] p-3 rounded space-y-3 animate-in fade-in duration-150">
          
          <div className="flex items-center justify-between flex-wrap gap-2 pb-1 border-b border-[#DCD6C5]">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-[#D94E28]" />
              <span className="font-bold text-xs text-[#1A1917]">
                AI Domain Guidance & Context Relaxation (Custom Screener Directives)
              </span>
            </div>

            {/* Model & Discard Controls */}
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <div className="flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-[#4F46E5]" />
                <span className="text-[10px] text-[#7A766F] font-bold">Model:</span>
                <select
                  value={autoScreenModel}
                  onChange={(e) => setAutoScreenModel(e.target.value)}
                  className="bg-white border border-[#C8C1AE] px-2 py-0.5 text-[10px] text-[#1A1917] rounded focus:outline-none"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep)</option>
                </select>
              </div>

              <label className="flex items-center gap-1 text-[10px] text-[#55524B] cursor-pointer" title="Uncheck to completely discard rejected papers from SQLite">
                <input
                  type="checkbox"
                  checked={!discardExcludedOnHarvest}
                  onChange={(e) => setDiscardExcludedOnHarvest(!e.target.checked)}
                  className="accent-[#D94E28] w-3 h-3 cursor-pointer"
                />
                <span>Save EXCLUDED (for PRISMA flow)</span>
              </label>
            </div>
          </div>

          {/* Context Guidance Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-[#7A766F]">
              <span>
                Provide domain nuance or loosen strict PICO constraints when empirical studies are scarce:
              </span>
              <span>{researchContext.length} chars</span>
            </div>

            <textarea
              rows={2}
              value={researchContext}
              onChange={(e) => setResearchContext(e.target.value)}
              placeholder='e.g. "Focus on Vietnamese mobile telecom phishing lures. If Vietnam-specific papers are scarce, accept Southeast Asian or global SMS/fraud datasets utilizing PhoBERT, BERT, or LLMs."'
              className="w-full bg-white border border-[#C8C1AE] p-2 text-xs font-sans text-[#1A1917] leading-relaxed rounded focus:outline-none focus:border-[#D94E28]"
            />
          </div>

          {/* Preset Chips */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[10px] font-bold text-[#7A766F]">Quick Presets:</span>
            {CONTEXT_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setResearchContext(preset.text)}
                className="bg-[#EDE9DF] hover:bg-[#DCD6C5] text-[#1A1917] px-2 py-0.5 text-[10px] rounded border border-[#C8C1AE] transition-colors cursor-pointer"
              >
                {preset.label}
              </button>
            ))}

            {researchContext && (
              <button
                type="button"
                onClick={() => setResearchContext('')}
                className="text-[#C93B2B] hover:underline text-[10px] ml-auto font-bold cursor-pointer"
              >
                Clear Guidance
              </button>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
