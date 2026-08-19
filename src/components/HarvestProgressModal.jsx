import React from 'react';
import { Search, Loader2, CheckCircle2, AlertCircle, ShieldAlert, Layers } from 'lucide-react';

export default function HarvestProgressModal({
  isOpen,
  progress, // { sources, sourceStatus, rawCount, dedupCount, uniqueCount, isDone, duration }
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
    duration = 0
  } = progress;

  const completedSources = Object.keys(sourceStatus).length;
  const totalSources = Math.max(1, sources.length);
  const percent = Math.min(100, Math.round((completedSources / totalSources) * 100));

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none">
      <div className="bg-[#1A1917] border-2 border-[#3D3A35] text-[#F4F1EA] max-w-lg w-full shadow-[8px_8px_0px_0px_rgba(45,122,83,0.4)] overflow-hidden font-mono">
        
        {/* Header */}
        <div className="bg-[#24221F] px-6 py-3 border-b border-[#33312E] flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-[#22C55E]">
            <Search className="w-5 h-5 animate-pulse" />
            <div>
              <span className="text-[10px] text-[#A09B8E] uppercase tracking-widest block font-bold">
                Multi-Source Concurrent Harvester
              </span>
              <h2 className="font-serif text-lg font-bold text-white tracking-wide">
                Harvesting Academic Metadata
              </h2>
            </div>
          </div>

          {isDone && (
            <button
              onClick={onClose}
              className="px-3 py-1 bg-[#2D7A53] hover:bg-[#236142] text-white text-xs font-bold rounded"
            >
              Done
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          
          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-[#C8C1AE]">
                {isDone ? 'Harvesting & Deduplication Finished' : `Querying Sources (${completedSources}/${totalSources})...`}
              </span>
              <span className="text-[#A09B8E]">
                {isDone ? `${duration}s` : `${percent}%`}
              </span>
            </div>

            <div className="w-full h-3 bg-[#2A2825] rounded-full overflow-hidden border border-[#3D3A35] p-0.5">
              <div
                className="h-full bg-gradient-to-r from-[#38BDF8] via-[#22C55E] to-[#EAB308] rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.max(3, percent)}%` }}
              />
            </div>
          </div>

          {/* Sources Status Cards */}
          <div className="space-y-2">
            <div className="text-[10px] text-[#7A766F] uppercase font-bold">Source Telemetry:</div>
            <div className="grid grid-cols-1 gap-2 text-xs">
              {sources.map(src => {
                const info = sourceStatus[src];
                const isFinished = !!info;
                const isSuccess = info && info.status === 'ok';
                const isError = info && info.status === 'error';

                return (
                  <div 
                    key={src} 
                    className={`p-2.5 rounded border flex items-center justify-between ${
                      isSuccess 
                        ? 'bg-[#142A1D] border-[#1E5237]' 
                        : isError 
                        ? 'bg-[#2D1212] border-[#521E1E]' 
                        : 'bg-[#24221F] border-[#3D3A35]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isSuccess ? (
                        <CheckCircle2 className="w-4 h-4 text-[#4ADE80]" />
                      ) : isError ? (
                        <AlertCircle className="w-4 h-4 text-[#F87171]" />
                      ) : (
                        <Loader2 className="w-4 h-4 animate-spin text-[#38BDF8]" />
                      )}
                      <span className="font-bold text-white">{src}</span>
                    </div>

                    <div className="text-[11px]">
                      {isSuccess && (
                        <span className="text-[#4ADE80] font-bold">
                          +{info.count} records ({info.duration_sec}s)
                        </span>
                      )}
                      {isError && (
                        <span className="text-[#F87171] truncate max-w-xs">
                          {info.error || 'Skipped'}
                        </span>
                      )}
                      {!isFinished && (
                        <span className="text-[#38BDF8] italic">Querying...</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deduplication & Net Yield Banner */}
          {isDone && (
            <div className="bg-[#121110] border border-[#2C2B29] p-3 rounded text-xs grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] text-[#7A766F] uppercase">Raw Fetched</div>
                <div className="text-base font-bold text-white mt-0.5">{rawCount}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#FBBF24] uppercase">Duplicates Filtered</div>
                <div className="text-base font-bold text-[#FBBF24] mt-0.5">{dedupCount}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#4ADE80] uppercase">New Added to DB</div>
                <div className="text-base font-bold text-[#4ADE80] mt-0.5">+{uniqueCount}</div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
