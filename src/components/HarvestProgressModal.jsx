import React from 'react';
import { 
  Search, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  ShieldAlert, 
  Layers, 
  Bot, 
  Sparkles, 
  GitMerge, 
  Database,
  ArrowRight,
  Clock,
  XCircle,
  HelpCircle,
  X
} from 'lucide-react';

export default function HarvestProgressModal({
  isOpen,
  progress,
  onClose
}) {
  if (!isOpen || !progress) return null;

  const {
    sources = [],
    sourceStatus = {}, // { 'ArXiv': { status: 'ok'|'crawling'|'error', count: 25, duration: 1.2 } }
    rawCount = 0,
    dedupCount = 0,
    uniqueCount = 0,
    isDone = false,
    duration = 0,
    stage = 'CRAWL', // 'CRAWL' | 'DEDUP' | 'AI_SCREEN' | 'COMPLETE' | 'ERROR'
    autoScreen = false,
    modelName = 'Gemini 2.5 Flash',
    screenedCount = 0,
    totalToScreen = 0,
    screenLogs = [], // [{ paper_id, title, decision, confidence, exclusion_reason }]
    aiStats = { INCLUDED: 0, EXCLUDED: 0, UNSURE: 0 },
    aiWarning = null,
    error = null
  } = progress;

  const completedSources = Object.keys(sourceStatus).length;
  const totalSources = Math.max(1, sources.length);
  const crawlPercent = Math.min(100, Math.round((completedSources / totalSources) * 100));

  const isError = stage === 'ERROR' || !!error;
  const isFinished = isDone || isError;

  // Determine stage active states
  const isCrawling = stage === 'CRAWL' && !isFinished;
  const isDeduping = stage === 'DEDUP' && !isFinished;
  const isScreening = stage === 'AI_SCREEN' && !isFinished;

  const aiScreenPercent = totalToScreen > 0 
    ? Math.min(100, Math.round((screenedCount / totalToScreen) * 100)) 
    : (isFinished ? 100 : 0);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none animate-in fade-in duration-200">
      <div className="bg-[#1A1917] border-2 border-[#3D3A35] text-[#F4F1EA] max-w-2xl w-full shadow-[0_16px_50px_rgba(0,0,0,0.8)] overflow-hidden font-mono flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#24221F] px-6 py-3.5 border-b border-[#33312E] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {autoScreen ? (
              <div className="p-1.5 bg-[#4F46E5]/20 border border-[#4F46E5] rounded-xs text-[#818CF8]">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
            ) : (
              <div className="p-1.5 bg-[#22C55E]/20 border border-[#22C55E] rounded-xs text-[#4ADE80]">
                <Search className="w-5 h-5 animate-pulse" />
              </div>
            )}
            
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#A09B8E] uppercase tracking-widest block font-bold">
                  Multi-Source Concurrent Harvester
                </span>
                {autoScreen && (
                  <span className="bg-[#4F46E5] text-white text-[9px] px-1.5 py-0.2 rounded font-bold uppercase">
                    AI Stream-Screening
                  </span>
                )}
              </div>
              <h2 className="font-serif text-lg font-bold text-white tracking-wide">
                {isError 
                  ? 'Harvest Pipeline Interrupted' 
                  : isFinished 
                  ? 'Harvest & Pipeline Finished' 
                  : autoScreen && isScreening 
                  ? 'Real-Time AI Screening in Progress...' 
                  : 'Harvesting Academic Metadata...'}
              </h2>
            </div>
          </div>

          {isFinished ? (
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#2D7A53] hover:bg-[#236142] text-white text-xs font-bold rounded-xs shadow-xs transition-colors cursor-pointer"
            >
              Done (Esc)
            </button>
          ) : (
            <button
              onClick={onClose}
              className="p-1 text-[#7A766F] hover:text-white transition-colors"
              title="Minimize progress window"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 4-STAGE PIPELINE STEPPER BAR */}
        <div className="bg-[#151413] border-b border-[#2C2B29] px-6 py-2.5 flex items-center justify-between text-[10px] uppercase font-bold shrink-0 overflow-x-auto gap-2">
          
          {/* Step 1: Crawling */}
          <div className={`flex items-center gap-1.5 ${
            isCrawling ? 'text-[#38BDF8] animate-pulse' : completedSources === totalSources ? 'text-[#4ADE80]' : 'text-[#7A766F]'
          }`}>
            {completedSources === totalSources ? <CheckCircle2 className="w-3.5 h-3.5 text-[#4ADE80]" /> : isCrawling ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#38BDF8]" /> : <Search className="w-3.5 h-3.5" />}
            <span>1. Crawl ({completedSources}/{totalSources})</span>
          </div>

          <ArrowRight className="w-3 h-3 text-[#3D3A35] shrink-0" />

          {/* Step 2: Deduplication */}
          <div className={`flex items-center gap-1.5 ${
            isDeduping ? 'text-[#FBBF24] animate-pulse' : (dedupCount > 0 || uniqueCount > 0 || isFinished) ? 'text-[#4ADE80]' : 'text-[#7A766F]'
          }`}>
            {(dedupCount > 0 || uniqueCount > 0 || isFinished) ? <CheckCircle2 className="w-3.5 h-3.5 text-[#4ADE80]" /> : isDeduping ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FBBF24]" /> : <GitMerge className="w-3.5 h-3.5" />}
            <span>2. Dedup</span>
          </div>

          <ArrowRight className="w-3 h-3 text-[#3D3A35] shrink-0" />

          {/* Step 3: AI Screening */}
          {autoScreen ? (
            <div className={`flex items-center gap-1.5 ${
              isScreening ? 'text-[#818CF8] animate-pulse font-extrabold' : isFinished ? 'text-[#4ADE80]' : 'text-[#7A766F]'
            }`}>
              {isFinished ? <CheckCircle2 className="w-3.5 h-3.5 text-[#4ADE80]" /> : isScreening ? <Sparkles className="w-3.5 h-3.5 animate-spin text-[#818CF8]" /> : <Bot className="w-3.5 h-3.5" />}
              <span>3. AI Screen</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[#55524B] line-through" title="Standard crawl mode (AI screening bypassed)">
              <span>3. AI Screen (Bypassed)</span>
            </div>
          )}

          <ArrowRight className="w-3 h-3 text-[#3D3A35] shrink-0" />

          {/* Step 4: Storage */}
          <div className={`flex items-center gap-1.5 ${
            isFinished ? 'text-[#4ADE80]' : 'text-[#7A766F]'
          }`}>
            {isFinished ? <CheckCircle2 className="w-3.5 h-3.5 text-[#4ADE80]" /> : <Database className="w-3.5 h-3.5" />}
            <span>4. SQLite Saved</span>
          </div>

        </div>

        {/* Modal Body with Live Telemetry */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-[#1A1917]">
          
          {/* Error / Interruption Banner */}
          {error && (
            <div className="bg-[#2D1212] border border-[#DC2626] text-[#FCA5A5] p-3 rounded text-xs flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0" />
                <span>Stream notice: {error}. Successfully retrieved papers are preserved in database.</span>
              </div>
            </div>
          )}

          {/* Progress Bar with Contextual Label */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-[#C8C1AE] flex items-center gap-1.5">
                {isCrawling && <span className="text-[#38BDF8]">Querying {totalSources} Academic Sources...</span>}
                {isDeduping && <span className="text-[#FBBF24]">Running Canonical Deduplication...</span>}
                {isScreening && <span className="text-[#818CF8]">Gemini AI Evaluating ({screenedCount}/{totalToScreen} Unique Records)...</span>}
                {isFinished && !isError && <span className="text-[#4ADE80]">Pipeline Complete! All records committed to SQLite.</span>}
                {isError && <span className="text-[#F87171]">Pipeline Stopped. Records saved to database.</span>}
              </span>
              <span className="text-[#A09B8E]">
                {isFinished ? `${duration}s` : autoScreen && isScreening ? `${aiScreenPercent}%` : `${crawlPercent}%`}
              </span>
            </div>

            <div className="w-full h-2.5 bg-[#2A2825] rounded-full overflow-hidden border border-[#3D3A35] p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ease-out ${
                  isError
                    ? 'bg-[#EF4444]'
                    : autoScreen && isScreening
                    ? 'bg-gradient-to-r from-[#4F46E5] via-[#818CF8] to-[#22C55E]'
                    : 'bg-gradient-to-r from-[#38BDF8] via-[#22C55E] to-[#EAB308]'
                }`}
                style={{ 
                  width: `${Math.max(4, isError ? 100 : autoScreen && isScreening ? aiScreenPercent : crawlPercent)}%` 
                }}
              />
            </div>
          </div>

          {/* REAL-TIME AI STREAM-SCREENING TELEMETRY (When Auto-Screen is Active) */}
          {autoScreen && (
            <div className="bg-[#151413] border border-[#3730A3]/60 p-3.5 rounded space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold text-white">
                  <Bot className="w-4 h-4 text-[#818CF8]" />
                  <span>Gemini AI Screener Feed</span>
                  <span className="bg-[#24221F] text-[#A09B8E] text-[10px] px-1.5 py-0.2 rounded border border-[#3D3A35]">
                    {modelName}
                  </span>
                </div>

                {/* AI Decision Pill Counters */}
                <div className="flex items-center gap-2 text-[10px] font-bold">
                  <span className="text-[#4ADE80] bg-[#142A1D] px-1.5 py-0.5 rounded border border-[#1E5237]">
                    ✓ {aiStats.INCLUDED || 0} Inc
                  </span>
                  <span className="text-[#F87171] bg-[#2D1212] px-1.5 py-0.5 rounded border border-[#521E1E]">
                    ✕ {aiStats.EXCLUDED || 0} Exc
                  </span>
                  <span className="text-[#C084FC] bg-[#22172E] px-1.5 py-0.5 rounded border border-[#4C1D95]">
                    ⏳ {aiStats.UNSURE || 0} Unsure
                  </span>
                </div>
              </div>

              {/* AI Warning Box if key is missing or API limit hit */}
              {aiWarning && (
                <div className="bg-[#2D1B0D] border border-[#B45309] text-[#FDE68A] p-2.5 rounded text-[11px] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#F59E0B] shrink-0" />
                  <span>{aiWarning}</span>
                </div>
              )}

              {/* Streaming Paper Evaluation Feed */}
              {screenLogs && screenLogs.length > 0 ? (
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1 text-[11px]">
                  {screenLogs.slice(-5).reverse().map((log, i) => {
                    const isInc = log.decision === 'INCLUDED';
                    const isExc = log.decision === 'EXCLUDED';
                    return (
                      <div 
                        key={i} 
                        className="bg-[#1F1E1B] p-1.5 rounded border border-[#2C2B29] flex items-center justify-between gap-2 animate-in fade-in duration-100"
                      >
                        <div className="flex items-center gap-1.5 truncate flex-1">
                          <span className={`px-1.5 py-0.2 font-bold text-[9px] rounded uppercase shrink-0 ${
                            isInc ? 'bg-[#142A1D] text-[#4ADE80] border border-[#1E5237]' :
                            isExc ? 'bg-[#2D1212] text-[#F87171] border border-[#521E1E]' :
                            'bg-[#22172E] text-[#C084FC] border border-[#4C1D95]'
                          }`}>
                            {log.decision}
                          </span>
                          <span className="text-white truncate font-sans text-xs">
                            {log.title}
                          </span>
                        </div>

                        <div className="text-[10px] text-[#A09B8E] shrink-0 font-bold">
                          {Math.round((log.confidence || 0.8) * 100)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[11px] text-[#7A766F] italic py-2 text-center">
                  {isCrawling ? 'Waiting for source harvesting and deduplication to complete...' : 'Initializing Gemini stream screener...'}
                </div>
              )}
            </div>
          )}

          {/* Sources Telemetry Matrix */}
          <div className="space-y-2">
            <div className="text-[10px] text-[#7A766F] uppercase font-bold flex items-center justify-between">
              <span>Source Harvest Telemetry:</span>
              <span>{completedSources}/{totalSources} Complete</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {sources.map(src => {
                const info = sourceStatus[src];
                const isFinishedSource = !!info;
                const isSuccess = info && info.status === 'ok';
                const isErrorSource = info && info.status === 'error';

                return (
                  <div 
                    key={src} 
                    className={`p-2 rounded border flex items-center justify-between ${
                      isSuccess 
                        ? 'bg-[#142A1D] border-[#1E5237]' 
                        : isErrorSource 
                        ? 'bg-[#2D1212] border-[#521E1E]' 
                        : 'bg-[#24221F] border-[#3D3A35]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isSuccess ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#4ADE80] shrink-0" />
                      ) : isErrorSource ? (
                        <AlertCircle className="w-3.5 h-3.5 text-[#F87171] shrink-0" />
                      ) : (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#38BDF8] shrink-0" />
                      )}
                      <span className="font-bold text-white truncate">{src}</span>
                    </div>

                    <div className="text-[10px]">
                      {isSuccess && (
                        <span className="text-[#4ADE80] font-bold">
                          +{info.count} ({info.duration_sec}s)
                        </span>
                      )}
                      {isErrorSource && (
                        <span className="text-[#F87171] truncate max-w-[90px]" title={info.error}>
                          {info.error || 'Skipped'}
                        </span>
                      )}
                      {!isFinishedSource && (
                        <span className="text-[#38BDF8] italic">Querying...</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Comprehensive Yield & Dedup Metrics Footer */}
          {isFinished && (
            <div className="bg-[#121110] border border-[#2C2B29] p-3.5 rounded text-xs space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center border-b border-[#2C2B29] pb-2">
                <div>
                  <div className="text-[10px] text-[#7A766F] uppercase">Raw Harvested</div>
                  <div className="text-base font-bold text-white mt-0.5">{rawCount}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#FBBF24] uppercase">Duplicates Filtered</div>
                  <div className="text-base font-bold text-[#FBBF24] mt-0.5">{dedupCount}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#4ADE80] uppercase">New Unique Papers</div>
                  <div className="text-base font-bold text-[#4ADE80] mt-0.5">+{uniqueCount}</div>
                </div>
              </div>

              {autoScreen && (
                <div className="flex items-center justify-between text-[11px] font-bold pt-1 px-1">
                  <span className="text-[#A09B8E]">AI Screening Breakdown:</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[#4ADE80]">✓ {aiStats.INCLUDED || 0} Included</span>
                    <span className="text-[#F87171]">✕ {aiStats.EXCLUDED || 0} Excluded</span>
                    <span className="text-[#C084FC]">⏳ {aiStats.UNSURE || 0} Unsure</span>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
