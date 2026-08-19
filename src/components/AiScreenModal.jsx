import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Key, 
  Eye, 
  EyeOff, 
  Check, 
  Loader2, 
  Cpu, 
  CheckSquare, 
  Layers, 
  Clock, 
  Database,
  Sliders
} from 'lucide-react';

export default function AiScreenModal({
  isOpen,
  onClose,
  pico,
  icList,
  ecList,
  onRunAiScreen,
  onOpenProtocolModal,
  isScreening,
  totalPapersCount = 0,
  pendingCount = 0,
  selectedPaperIds = new Set(),
  filteredPaperIds = [],
  currentFilterStage = 'ALL'
}) {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('rbl_gemini_key') || '');
  const [modelName, setModelName] = useState(() => {
    const saved = localStorage.getItem('rbl_gemini_model');
    if (saved && (saved.includes('1.5') || saved.includes('2.0') || saved === 'models/gemini-pro')) {
      localStorage.removeItem('rbl_gemini_model');
      return 'auto';
    }
    return saved || 'auto';
  });
  const [showKey, setShowKey] = useState(false);

  const selectedCount = selectedPaperIds ? selectedPaperIds.size : 0;
  const filteredCount = filteredPaperIds ? filteredPaperIds.length : totalPapersCount;

  // 4 Scopes: 'TICKED_ONLY' | 'CURRENT_TAB' | 'PENDING_ONLY' | 'ALL_RECORDS'
  const [targetScope, setTargetScope] = useState('CURRENT_TAB');

  // Smart Contextual Defaulting Logic
  useEffect(() => {
    if (isOpen) {
      if (selectedCount > 0) {
        setTargetScope('TICKED_ONLY');
      } else if (currentFilterStage === 'PENDING') {
        setTargetScope('PENDING_ONLY');
      } else {
        setTargetScope('CURRENT_TAB');
      }
    }
  }, [isOpen, selectedCount, currentFilterStage]);

  if (!isOpen) return null;

  // Calculate target paper count for the active scope
  const getTargetCount = () => {
    switch (targetScope) {
      case 'TICKED_ONLY':
        return selectedCount;
      case 'CURRENT_TAB':
        return filteredCount;
      case 'PENDING_ONLY':
        return pendingCount;
      case 'ALL_RECORDS':
        return totalPapersCount;
      default:
        return totalPapersCount;
    }
  };

  const targetCount = getTargetCount();

  const handleSaveKeyAndRun = (e) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      alert('Please enter your Google Gemini API Key.');
      return;
    }

    if (targetCount === 0) {
      alert('No papers match the selected screening scope.');
      return;
    }

    localStorage.setItem('rbl_gemini_key', apiKey.trim());
    localStorage.setItem('rbl_gemini_model', modelName);

    let resolvedPaperIds = null;
    if (targetScope === 'TICKED_ONLY') {
      resolvedPaperIds = Array.from(selectedPaperIds);
    } else if (targetScope === 'CURRENT_TAB') {
      resolvedPaperIds = filteredPaperIds;
    } else if (targetScope === 'PENDING_ONLY') {
      resolvedPaperIds = 'PENDING';
    } else if (targetScope === 'ALL_RECORDS') {
      resolvedPaperIds = null; // signals full corpus
    }

    onRunAiScreen({
      apiKey: apiKey.trim(),
      modelName,
      pico,
      icList,
      ecList,
      scope: targetScope,
      paperIds: Array.isArray(resolvedPaperIds) ? resolvedPaperIds : (resolvedPaperIds === 'PENDING' ? 'PENDING' : null)
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#F4F1EA] border-2 border-[#1A1917] max-w-2xl w-full shadow-[8px_8px_0px_0px_rgba(26,25,23,0.85)] overflow-hidden my-6 font-mono">
        
        {/* Header */}
        <div className="bg-[#1A1917] text-[#F4F1EA] px-6 py-3 border-b-2 border-[#1A1917] flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-[#D94E28]">
            <Sparkles className="w-5 h-5 animate-pulse" />
            <div>
              <div className="font-mono text-[10px] text-[#A09B8E] uppercase tracking-widest font-bold">
                PRISMA 2020 Protocol • Gemini LLM-as-a-Judge
              </div>
              <h2 className="font-serif text-lg font-bold text-white tracking-wide">
                AI Screening Scope & Engine Configuration
              </h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-[#33312E] text-[#A09B8E] hover:text-white transition-colors"
            title="Close modal (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informational Banner */}
        <div className="bg-[#EDE9DF] px-6 py-2 border-b border-[#DCD6C5] font-mono text-[11px] text-[#4A4843] flex items-center justify-between">
          <span>Evaluates Title + Abstract against 5 IC and 5 EC criteria rules.</span>
          <span className="font-bold text-[#D94E28]">Zero Data Fabrication</span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSaveKeyAndRun} className="p-6 space-y-4 text-xs">
          
          {/* Gemini API Key & Model Selector */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-[#1A1917] mb-1 uppercase flex items-center gap-1">
                <Key className="w-3.5 h-3.5 text-[#B8860B]" />
                <span>Google Gemini API Key</span>
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-[#F8F6F0] border border-[#C8C1AE] p-2 pr-8 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28] font-mono rounded-xs"
                  placeholder="AIzaSy..."
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-2 text-[#7A766F] hover:text-[#1A1917]"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#1A1917] mb-1 uppercase flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-[#2D7A53]" />
                <span>AI Model</span>
              </label>
              <select
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full bg-[#F8F6F0] border border-[#C8C1AE] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28] cursor-pointer font-mono rounded-xs"
              >
                <option value="auto">Auto-Discover (Best)</option>
                <option value="models/gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="models/gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite</option>
                <option value="models/gemini-3-flash">Gemini 3 Flash</option>
                <option value="models/gemini-3-pro">Gemini 3 Pro</option>
                <option value="models/gemini-2.5-pro">Gemini 2.5 Pro</option>
              </select>
            </div>
          </div>

          {/* 4-Tier Interactive Scope Selector */}
          <div className="space-y-2 pt-1">
            <label className="block text-[11px] font-bold text-[#1A1917] uppercase tracking-wider">
              Select Screening Scope (Target Literature):
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              {/* Option 1: Selected / Ticked Records Only */}
              <div
                onClick={() => {
                  if (selectedCount > 0) setTargetScope('TICKED_ONLY');
                }}
                className={`p-3 rounded border transition-all select-none ${
                  selectedCount === 0
                    ? 'opacity-50 cursor-not-allowed bg-[#EFECE4] border-[#DCD6C5]'
                    : targetScope === 'TICKED_ONLY'
                    ? 'bg-[#FFF9EB] border-2 border-[#D94E28] text-[#1A1917] shadow-xs cursor-pointer ring-1 ring-[#D94E28]'
                    : 'bg-[#F8F6F0] border border-[#DCD6C5] hover:border-[#C8C1AE] text-[#4A4843] cursor-pointer'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckSquare className={`w-4 h-4 shrink-0 ${targetScope === 'TICKED_ONLY' ? 'text-[#D94E28]' : 'text-[#7A766F]'}`} />
                    <span className="font-bold text-xs text-[#1A1917]">Selected (Ticked) Only</span>
                  </div>
                  <span className={`font-mono font-bold text-[10px] px-1.5 py-0.2 rounded border ${
                    targetScope === 'TICKED_ONLY'
                      ? 'bg-[#D94E28] text-white border-[#D94E28]'
                      : 'bg-[#EDE9DF] text-[#1A1917] border-[#DCD6C5]'
                  }`}>
                    {selectedCount} papers
                  </span>
                </div>
                <p className="text-[10px] text-[#7A766F] font-sans mt-1 leading-snug">
                  {selectedCount > 0
                    ? `Default: Screen only the ${selectedCount} papers currently checked in table.`
                    : 'No papers checked in table. Use checkboxes to enable.'}
                </p>
              </div>

              {/* Option 2: Current Tab / Filter View */}
              <div
                onClick={() => setTargetScope('CURRENT_TAB')}
                className={`p-3 rounded border transition-all cursor-pointer select-none ${
                  targetScope === 'CURRENT_TAB'
                    ? 'bg-[#FFF9EB] border-2 border-[#D94E28] text-[#1A1917] shadow-xs ring-1 ring-[#D94E28]'
                    : 'bg-[#F8F6F0] border border-[#DCD6C5] hover:border-[#C8C1AE] text-[#4A4843]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className={`w-4 h-4 shrink-0 ${targetScope === 'CURRENT_TAB' ? 'text-[#D94E28]' : 'text-[#7A766F]'}`} />
                    <span className="font-bold text-xs text-[#1A1917]">Current Tab View</span>
                  </div>
                  <span className={`font-mono font-bold text-[10px] px-1.5 py-0.2 rounded border ${
                    targetScope === 'CURRENT_TAB'
                      ? 'bg-[#D94E28] text-white border-[#D94E28]'
                      : 'bg-[#EDE9DF] text-[#1A1917] border-[#DCD6C5]'
                  }`}>
                    {filteredCount} papers
                  </span>
                </div>
                <p className="text-[10px] text-[#7A766F] font-sans mt-1 leading-snug">
                  Screen all papers currently visible in tab <strong>"{currentFilterStage}"</strong>.
                </p>
              </div>

              {/* Option 3: Pending Only */}
              <div
                onClick={() => setTargetScope('PENDING_ONLY')}
                className={`p-3 rounded border transition-all cursor-pointer select-none ${
                  targetScope === 'PENDING_ONLY'
                    ? 'bg-[#FFF9EB] border-2 border-[#D94E28] text-[#1A1917] shadow-xs ring-1 ring-[#D94E28]'
                    : 'bg-[#F8F6F0] border border-[#DCD6C5] hover:border-[#C8C1AE] text-[#4A4843]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className={`w-4 h-4 shrink-0 ${targetScope === 'PENDING_ONLY' ? 'text-[#B8860B]' : 'text-[#7A766F]'}`} />
                    <span className="font-bold text-xs text-[#1A1917]">Pending / Unreviewed</span>
                  </div>
                  <span className={`font-mono font-bold text-[10px] px-1.5 py-0.2 rounded border ${
                    targetScope === 'PENDING_ONLY'
                      ? 'bg-[#B8860B] text-white border-[#B8860B]'
                      : 'bg-[#EDE9DF] text-[#1A1917] border-[#DCD6C5]'
                  }`}>
                    {pendingCount} papers
                  </span>
                </div>
                <p className="text-[10px] text-[#7A766F] font-sans mt-1 leading-snug">
                  Skip already decided papers; evaluate only records awaiting review.
                </p>
              </div>

              {/* Option 4: All Records in Corpus */}
              <div
                onClick={() => setTargetScope('ALL_RECORDS')}
                className={`p-3 rounded border transition-all cursor-pointer select-none ${
                  targetScope === 'ALL_RECORDS'
                    ? 'bg-[#FFF9EB] border-2 border-[#D94E28] text-[#1A1917] shadow-xs ring-1 ring-[#D94E28]'
                    : 'bg-[#F8F6F0] border border-[#DCD6C5] hover:border-[#C8C1AE] text-[#4A4843]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Database className={`w-4 h-4 shrink-0 ${targetScope === 'ALL_RECORDS' ? 'text-[#2D7A53]' : 'text-[#7A766F]'}`} />
                    <span className="font-bold text-xs text-[#1A1917]">All Corpus Records</span>
                  </div>
                  <span className={`font-mono font-bold text-[10px] px-1.5 py-0.2 rounded border ${
                    targetScope === 'ALL_RECORDS'
                      ? 'bg-[#2D7A53] text-white border-[#2D7A53]'
                      : 'bg-[#EDE9DF] text-[#1A1917] border-[#DCD6C5]'
                  }`}>
                    {totalPapersCount} papers
                  </span>
                </div>
                <p className="text-[10px] text-[#7A766F] font-sans mt-1 leading-snug">
                  Full re-evaluation of all {totalPapersCount} papers against active protocol.
                </p>
              </div>

            </div>
          </div>

          {/* Decision Rules Reminder Box */}
          <div className="bg-[#F8F6F0] border border-[#DCD6C5] p-3 space-y-1.5 text-[10px] text-[#4A4843] rounded">
            <div className="flex items-center justify-between">
              <div className="font-bold text-[#1A1917] uppercase flex items-center gap-1">
                <Sliders className="w-3 h-3 text-[#D94E28]" />
                <span>Active Research Protocol (PICO + 5 IC / 5 EC):</span>
              </div>
              {onOpenProtocolModal && (
                <button
                  type="button"
                  onClick={() => { onClose(); onOpenProtocolModal(); }}
                  className="text-[#D94E28] hover:underline font-bold"
                >
                  Edit Protocol ⚙
                </button>
              )}
            </div>
            <div>• <strong className="text-[#2D7A53]">✓ INCLUDED</strong>: Satisfies primary ICs (5 rules) and matches 0 ECs (Confidence ≥ 80%).</div>
            <div>• <strong className="text-[#C93B2B]">✕ EXCLUDED</strong>: Matches any EC ({ecList?.length || 5} rules) with explicit code tag recorded.</div>
            <div>• <strong className="text-[#805AD5]">❓ UNSURE</strong>: Abstract lacks methodology details, borderline relevance, or Confidence &lt; 70%.</div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-[#DCD6C5]">
            <div className="text-[11px] text-[#7A766F] font-mono">
              Target Corpus: <strong className="text-[#D94E28] font-bold">{targetCount} papers</strong>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 bg-[#EDE9DF] hover:bg-[#DCD6C5] text-[#1A1917] font-bold rounded border border-[#C8C1AE] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isScreening || !apiKey.trim() || targetCount === 0}
                className="bg-[#D94E28] hover:bg-[#C4411C] py-2 px-5 font-bold flex items-center gap-2 text-white rounded transition-all shadow-xs disabled:opacity-50"
              >
                {isScreening ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Evaluating with Gemini...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Run AI Screening ({targetCount} Papers)</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}
