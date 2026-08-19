import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Clock, 
  ShieldCheck, 
  Minimize2, 
  Terminal, 
  Copy, 
  Check, 
  Code, 
  FileText, 
  Layers, 
  ArrowDown, 
  Filter
} from 'lucide-react';

export default function AiScreenProgressModal({
  isOpen,
  progress,
  onClose,
  onMinimize
}) {
  const [activeTab, setActiveTab] = useState('STREAM'); // 'STREAM' | 'DASHBOARD'
  const [streamFilter, setStreamFilter] = useState('ALL'); // 'ALL' | 'INCLUDED' | 'EXCLUDED' | 'UNSURE'
  const [expandedJsonIds, setExpandedJsonIds] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const streamEndRef = useRef(null);

  const evalLogs = progress?.evalLogs || [];

  // Auto-scroll stream to bottom when new papers arrive (MUST be called unconditionally before early return)
  useEffect(() => {
    if (isOpen && autoScroll && streamEndRef.current && activeTab === 'STREAM') {
      try {
        streamEndRef.current.scrollIntoView({ behavior: 'smooth' });
      } catch (err) {
        // Safe fallback
      }
    }
  }, [evalLogs, autoScroll, activeTab, isOpen]);

  if (!isOpen || !progress) return null;

  const {
    total = 0,
    evaluated = 0,
    percent = 0,
    currentTitle = '',
    currentId = '',
    lastDecision = null,
    lastConfidence = 0,
    lastRationale = '',
    stats = { INCLUDED: 0, EXCLUDED: 0, UNSURE: 0 },
    eta = 0,
    activeModel = 'Gemini Flash',
    isDone = false
  } = progress;

  const formatEta = (seconds) => {
    if (seconds <= 0) return 'Few seconds';
    if (seconds < 60) return `~${seconds}s remaining`;
    const mins = Math.ceil(seconds / 60);
    return `~${mins} min remaining`;
  };

  const toggleJsonExpand = (id) => {
    const next = new Set(expandedJsonIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedJsonIds(next);
  };

  const copyRawJson = (id, jsonPayload) => {
    navigator.clipboard.writeText(JSON.stringify(jsonPayload, null, 2));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const safeLogs = Array.isArray(evalLogs) ? evalLogs : [];
  const filteredLogs = safeLogs.filter(item => {
    if (!item) return false;
    if (streamFilter === 'INCLUDED' && item.decision !== 'INCLUDED') return false;
    if (streamFilter === 'EXCLUDED' && item.decision !== 'EXCLUDED') return false;
    if (streamFilter === 'UNSURE' && item.decision !== 'UNSURE') return false;
    return true;
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none animate-in fade-in duration-200">
      <div className="bg-[#F4F1EA] border-2 border-[#1A1917] text-[#1A1917] max-w-4xl w-full shadow-[8px_8px_0px_0px_rgba(26,25,23,0.85)] overflow-hidden font-mono flex flex-col max-h-[92vh]">
        
        {/* Top Header */}
        <div className="bg-[#1A1917] text-[#F4F1EA] px-6 py-3 border-b-2 border-[#1A1917] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 text-[#D94E28]">
            <Sparkles className="w-5 h-5 animate-pulse" />
            <div>
              <span className="text-[10px] text-[#A09B8E] uppercase tracking-widest block font-bold">
                PRISMA 2020 Protocol • Micro-Batch Observability
              </span>
              <h2 className="font-serif text-lg font-bold text-white tracking-wide">
                Gemini AI Auto-Screening Console
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isDone && (
              <button
                onClick={onMinimize}
                className="px-2.5 py-1.5 bg-[#2C2B29] hover:bg-[#3D3A35] text-[#F4F1EA] text-xs flex items-center gap-1.5 rounded border border-[#44413B] transition-colors"
                title="Minimize modal to background floating dock"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Minimize to Dock</span>
              </button>
            )}
            {isDone && (
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-[#2D7A53] hover:bg-[#236142] text-white text-xs font-bold rounded shadow-xs transition-colors"
              >
                View Corpus ({evaluated} Done)
              </button>
            )}
          </div>
        </div>

        {/* Tab & Filter Bar (Light Editorial Style) */}
        <div className="bg-[#EDE9DF] border-b border-[#DCD6C5] px-6 py-2 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('STREAM')}
              className={`px-3 py-1.5 font-bold rounded flex items-center gap-1.5 transition-all shadow-2xs ${
                activeTab === 'STREAM'
                  ? 'bg-[#D94E28] text-white'
                  : 'bg-[#E5E0D3] text-[#4A4843] hover:bg-[#DDD7C8] hover:text-[#1A1917]'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Real-Time Gemini Stream</span>
              <span className="bg-black/20 text-white px-1.5 py-0.2 rounded text-[10px]">
                {evalLogs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('DASHBOARD')}
              className={`px-3 py-1.5 font-bold rounded flex items-center gap-1.5 transition-all shadow-2xs ${
                activeTab === 'DASHBOARD'
                  ? 'bg-[#D94E28] text-white'
                  : 'bg-[#E5E0D3] text-[#4A4843] hover:bg-[#DDD7C8] hover:text-[#1A1917]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Telemetry Dashboard</span>
            </button>
          </div>

          {/* Stream Filter Controls */}
          {activeTab === 'STREAM' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-[#E5E0D3] p-0.5 rounded border border-[#DCD6C5] text-[10px]">
                <button
                  onClick={() => setStreamFilter('ALL')}
                  className={`px-2 py-0.5 rounded ${streamFilter === 'ALL' ? 'bg-[#1A1917] text-white font-bold' : 'text-[#7A766F] hover:text-[#1A1917]'}`}
                >
                  All ({evalLogs.length})
                </button>
                <button
                  onClick={() => setStreamFilter('INCLUDED')}
                  className={`px-2 py-0.5 rounded ${streamFilter === 'INCLUDED' ? 'bg-[#D4EBD9] text-[#2D7A53] border border-[#98D4A5] font-bold' : 'text-[#7A766F] hover:text-[#1A1917]'}`}
                >
                  Inc ({stats?.INCLUDED || 0})
                </button>
                <button
                  onClick={() => setStreamFilter('EXCLUDED')}
                  className={`px-2 py-0.5 rounded ${streamFilter === 'EXCLUDED' ? 'bg-[#FADBD8] text-[#C93B2B] border border-[#F5B7B1] font-bold' : 'text-[#7A766F] hover:text-[#1A1917]'}`}
                >
                  Exc ({stats?.EXCLUDED || 0})
                </button>
                <button
                  onClick={() => setStreamFilter('UNSURE')}
                  className={`px-2 py-0.5 rounded ${streamFilter === 'UNSURE' ? 'bg-[#E9D8FD] text-[#6B46C1] border border-[#D6BCFA] font-bold' : 'text-[#7A766F] hover:text-[#1A1917]'}`}
                >
                  Unsure ({stats?.UNSURE || 0})
                </button>
              </div>

              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`p-1.5 rounded border text-[10px] flex items-center gap-1 transition-colors ${
                  autoScroll
                    ? 'bg-[#2D7A53] border-[#1E5237] text-white'
                    : 'bg-[#E5E0D3] border-[#DCD6C5] text-[#4A4843]'
                }`}
                title="Toggle auto-scroll lock"
              >
                <ArrowDown className="w-3 h-3" />
                <span>{autoScroll ? 'Auto-Scroll ON' : 'Scroll Locked'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Granular Progress Summary Strip */}
        <div className="bg-[#EFECE4] border-b border-[#DCD6C5] px-6 py-2.5 flex items-center justify-between shrink-0 text-xs flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#D94E28] animate-ping inline-block"></span>
            <span className="font-bold text-[#1A1917]">
              {isDone ? 'Completed 100%' : `Evaluating ${evaluated} of ${total} papers (${percent}%)`}
            </span>
            <span className="text-[#A09B8E]">•</span>
            <span className="text-[#7A766F] flex items-center gap-1 font-semibold">
              <Clock className="w-3 h-3 text-[#D94E28]" />
              {isDone ? 'Finished' : formatEta(eta)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] flex-wrap">
            <span className="text-[#7A766F] font-semibold">Model:</span>
            <span className="bg-[#EDE9DF] border border-[#C8C1AE] px-2 py-0.5 text-[#6B46C1] font-bold rounded flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-[#6B46C1]" />
              <span>{typeof activeModel === 'string' ? activeModel.replace('models/', '') : 'gemini-2.0-flash'}</span>
            </span>

            {/* Cooling models */}
            {progress?.coolingModels && Object.entries(progress.coolingModels).map(([cModel, rem]) => (
              <span 
                key={cModel} 
                className="bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] px-1.5 py-0.5 text-[10px] font-bold rounded flex items-center gap-1"
                title={`${cModel} is resting to replenish quota (${rem}s left)`}
              >
                <Clock className="w-2.5 h-2.5 text-[#F59E0B] animate-spin" />
                <span>{cModel.replace('models/', '')} ({rem}s)</span>
              </span>
            ))}
          </div>
        </div>

        {/* Progress Bar Line */}
        <div className="w-full h-1.5 bg-[#DCD6C5] overflow-hidden shrink-0">
          <div
            className="h-full bg-gradient-to-r from-[#D94E28] via-[#EA580C] to-[#22C55E] transition-all duration-300 ease-out"
            style={{ width: `${Math.max(2, percent)}%` }}
          />
        </div>

        {/* Modal Scrollable Content (Warm Light Theme) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3.5 bg-[#F4F1EA]">
          
          {/* Rate-Limit / Cooldown Banner */}
          {progress?.rateLimitNotice && (
            <div className="bg-[#FFFBEB] border border-[#F59E0B] text-[#92400E] p-2.5 rounded text-xs flex items-start gap-2.5 animate-in fade-in">
              <Clock className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5 animate-spin" />
              <div className="space-y-0.5 flex-1">
                <span className="font-bold">Circuit Breaker & Rate-Limit Cooldown:</span>
                <p className="text-[11px] leading-snug">{progress.rateLimitNotice}</p>
              </div>
            </div>
          )}
          
          {/* TAB 1: REAL-TIME STREAM & API RESPONSE INSPECTOR */}
          {activeTab === 'STREAM' && (
            <div className="space-y-3 font-mono text-xs">
              
              {filteredLogs.length === 0 && (
                <div className="text-center py-12 text-[#7A766F] space-y-2 bg-[#EFECE4] border border-[#DCD6C5] rounded">
                  <Loader2 className="w-6 h-6 animate-spin text-[#D94E28] mx-auto" />
                  <p className="font-semibold">Awaiting streaming micro-batch evaluations from Gemini...</p>
                </div>
              )}

              {filteredLogs.map((item, idx) => {
                if (!item) return null;
                const isInc = item.decision === 'INCLUDED';
                const isExc = item.decision === 'EXCLUDED';
                const confidencePct = Math.round((item.confidence || 0.85) * 100);
                const isJsonExpanded = expandedJsonIds.has(item.paper_id);

                return (
                  <div
                    key={item.paper_id || idx}
                    className={`border p-4 rounded space-y-2.5 transition-all shadow-xs ${
                      isInc
                        ? 'bg-[#F4F8F5] border-[#98D4A5] border-l-4 border-l-[#2D7A53]'
                        : isExc
                        ? 'bg-[#FDF2F2] border-[#F5B7B1] border-l-4 border-l-[#C93B2B]'
                        : 'bg-[#FAF5FF] border-[#D6BCFA] border-l-4 border-l-[#805AD5]'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#1A1917] bg-[#EDE9DF] px-2 py-0.5 rounded border border-[#C8C1AE]">
                          {item.paper_id}
                        </span>

                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] flex items-center gap-1 border ${
                          isInc
                            ? 'bg-[#D4EBD9] text-[#2D7A53] border-[#98D4A5]'
                            : isExc
                            ? 'bg-[#FADBD8] text-[#C93B2B] border-[#F5B7B1]'
                            : 'bg-[#E9D8FD] text-[#6B46C1] border-[#D6BCFA]'
                        }`}>
                          {isInc && <CheckCircle2 className="w-3 h-3" />}
                          {isExc && <XCircle className="w-3 h-3" />}
                          {!isInc && !isExc && <HelpCircle className="w-3 h-3" />}
                          <span>{item.decision}</span>
                        </span>

                        <span className="text-[11px] text-[#7A766F]">
                          Confidence: <strong className="text-[#1A1917]">{confidencePct}%</strong>
                        </span>

                        {item.latency_seconds && (
                          <span className="text-[10px] text-[#A09B8E]">
                            • {item.latency_seconds}s
                          </span>
                        )}
                      </div>

                      {/* Controls: Raw JSON toggle & Copy */}
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <button
                          onClick={() => toggleJsonExpand(item.paper_id)}
                          className="px-2 py-0.5 bg-[#EDE9DF] hover:bg-[#DCD6C5] text-[#1A1917] rounded flex items-center gap-1 border border-[#C8C1AE] transition-colors font-bold"
                        >
                          <Code className="w-3 h-3 text-[#D94E28]" />
                          <span>{isJsonExpanded ? 'Hide JSON' : 'Raw JSON'}</span>
                        </button>

                        <button
                          onClick={() => copyRawJson(item.paper_id, item.raw_json || item)}
                          className="p-1 bg-[#EDE9DF] hover:bg-[#DCD6C5] text-[#4A4843] hover:text-[#1A1917] rounded border border-[#C8C1AE] transition-colors"
                          title="Copy raw Gemini JSON output"
                        >
                          {copiedId === item.paper_id ? (
                            <Check className="w-3 h-3 text-[#2D7A53]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Paper Title & Metadata */}
                    <div className="font-serif italic text-[#1A1917] text-sm leading-snug font-medium">
                      "{item.title || 'Untitled'}"
                    </div>

                    {/* Criteria Codes Evaluation */}
                    <div className="flex items-center gap-2 flex-wrap text-[10px]">
                      {(() => {
                        const criteria = Array.isArray(item.matched_criteria)
                          ? item.matched_criteria
                          : typeof item.matched_criteria === 'string' && item.matched_criteria.trim()
                          ? [item.matched_criteria.trim()]
                          : [];
                        
                        if (criteria.length === 0) return null;

                        return (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[#7A766F] font-semibold">Matched:</span>
                            {criteria.map((c, i) => (
                              <span key={i} className="bg-[#DBEAFE] text-[#1E40AF] border border-[#93C5FD] px-1.5 py-0.2 rounded font-bold">
                                {typeof c === 'string' ? c : JSON.stringify(c)}
                              </span>
                            ))}
                          </div>
                        );
                      })()}

                      {item.exclusion_reason && (
                        <div className="bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5] px-2 py-0.5 rounded font-bold">
                          Triggered: {item.exclusion_reason}
                        </div>
                      )}
                    </div>

                    {/* Gemini Scientific Rationale / Justification Trace */}
                    {item.rationale && (
                      <div className="bg-[#FDFCF9] border border-[#DCD6C5] border-l-4 border-l-[#D94E28] p-3 rounded text-[11px] text-[#2C2B29] font-sans leading-relaxed shadow-2xs">
                        <span className="text-[#D94E28] font-bold font-mono uppercase text-[10px] block mb-0.5 tracking-wider">
                          Gemini Peer-Review Justification:
                        </span>
                        {item.rationale}
                      </div>
                    )}

                    {/* Raw JSON Accordion View (Light Theme Codebox) */}
                    {isJsonExpanded && (
                      <div className="bg-[#F8F6F0] border border-[#C8C1AE] p-3 rounded text-[10px] overflow-x-auto text-[#1F2937] shadow-inner">
                        <div className="text-[#7A766F] uppercase text-[9px] mb-1 font-bold">
                          Raw Gemini API Response Payload:
                        </div>
                        <pre className="font-mono leading-tight whitespace-pre-wrap font-semibold">
                          {JSON.stringify(item.raw_json || item, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}

              <div ref={streamEndRef} />
            </div>
          )}

          {/* TAB 2: TELEMETRY DASHBOARD */}
          {activeTab === 'DASHBOARD' && (
            <div className="space-y-5">
              {/* Counters */}
              <div className="grid grid-cols-4 gap-3 text-center text-xs">
                <div className="bg-[#D4EBD9] border border-[#98D4A5] p-3.5 rounded shadow-xs">
                  <div className="text-[10px] text-[#2D7A53] font-bold uppercase flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Included
                  </div>
                  <div className="text-2xl font-bold text-[#1A1917] mt-1">{stats?.INCLUDED || 0}</div>
                </div>

                <div className="bg-[#FADBD8] border border-[#F5B7B1] p-3.5 rounded shadow-xs">
                  <div className="text-[10px] text-[#C93B2B] font-bold uppercase flex items-center justify-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Excluded
                  </div>
                  <div className="text-2xl font-bold text-[#1A1917] mt-1">{stats?.EXCLUDED || 0}</div>
                </div>

                <div className="bg-[#E9D8FD] border border-[#D6BCFA] p-3.5 rounded shadow-xs">
                  <div className="text-[10px] text-[#6B46C1] font-bold uppercase flex items-center justify-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" /> Unsure
                  </div>
                  <div className="text-2xl font-bold text-[#1A1917] mt-1">{stats?.UNSURE || 0}</div>
                </div>

                <div className="bg-[#EDE9DF] border border-[#C8C1AE] p-3.5 rounded shadow-xs">
                  <div className="text-[10px] text-[#7A766F] font-bold uppercase">Remaining</div>
                  <div className="text-2xl font-bold text-[#1A1917] mt-1">{Math.max(0, total - evaluated)}</div>
                </div>
              </div>

              {/* Current evaluating card */}
              <div className="bg-[#FFFFFF] border border-[#DCD6C5] p-4 space-y-2 rounded shadow-xs text-xs">
                <div className="text-[10px] text-[#7A766F] uppercase font-bold flex items-center justify-between border-b border-[#EDE9DF] pb-1.5">
                  <span>Current Micro-Batch Focus</span>
                  {currentId && <span className="text-[#D94E28] font-bold">Target ID: {currentId}</span>}
                </div>

                {currentTitle ? (
                  <div className="space-y-2 pt-1">
                    <div className="text-[#1A1917] font-serif italic text-sm leading-snug font-medium">
                      "{currentTitle}"
                    </div>

                    {lastDecision && (
                      <div className="flex items-center gap-2 pt-2 border-t border-[#EDE9DF]">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          lastDecision === 'INCLUDED' 
                            ? 'bg-[#D4EBD9] text-[#2D7A53] border border-[#98D4A5]'
                            : lastDecision === 'EXCLUDED'
                            ? 'bg-[#FADBD8] text-[#C93B2B] border border-[#F5B7B1]'
                            : 'bg-[#E9D8FD] text-[#6B46C1] border border-[#D6BCFA]'
                        }`}>
                          {lastDecision} ({Math.round(lastConfidence * 100)}%)
                        </span>

                        {lastRationale && (
                          <span className="text-[11px] text-[#7A766F] truncate font-sans">
                            {lastRationale}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[#7A766F] italic py-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#D94E28]" />
                    <span>Processing micro-batches with Gemini...</span>
                  </div>
                )}
              </div>

              {/* Architecture Guarantees */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-[#FFFFFF] border border-[#DCD6C5] p-3 rounded space-y-1 shadow-2xs">
                  <div className="font-bold text-[#1A1917] flex items-center gap-1.5 text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#2D7A53]" />
                    <span>Zero-Timeout Micro-Batching</span>
                  </div>
                  <p className="text-[10px] text-[#7A766F]">
                    Chunk size: 10 papers per HTTP POST with auto-retry and backpressure safeguards.
                  </p>
                </div>

                <div className="bg-[#FFFFFF] border border-[#DCD6C5] p-3 rounded space-y-1 shadow-2xs">
                  <div className="font-bold text-[#1A1917] flex items-center gap-1.5 text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#2D7A53]" />
                    <span>Incremental SQLite Commits</span>
                  </div>
                  <p className="text-[10px] text-[#7A766F]">
                    Every paper verdict is atomically committed to SQLite immediately upon Gemini evaluation.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
