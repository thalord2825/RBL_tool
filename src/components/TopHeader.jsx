import React from 'react';
import { Download, GitCommit, RefreshCw, Sparkles, Sliders, Activity, FileSpreadsheet } from 'lucide-react';

export default function TopHeader({ 
  totalCount,
  includedCount,
  excludedCount,
  pendingCount,
  unsureCount,
  duplicatesCount,
  extractedCount = 0,
  icCount = 5,
  ecCount = 5,
  isScreening = false,
  aiProgress = null,
  harvestProgress = null,
  onOpenHarvestProgressModal,
  onOpenAiScreen,
  onOpenAiProgressModal,
  onOpenProtocolModal,
  onOpenCsvImport,
  onOpenGitSettings, 
  onOpenExportModal,
  onRefreshCorpus,
  isRefreshing
}) {
  return (
    <header className="bg-[#1A1917] text-[#F4F1EA] border-b border-[#3D3A35] select-none shrink-0 px-4 py-2 flex items-center justify-between gap-4">
      
      {/* Left: Branding */}
      <div className="flex items-center gap-3 shrink-0">
        <h1 className="font-serif text-xl italic tracking-wide text-white font-bold">
          Research Intelligence
        </h1>
        <span className="font-mono text-[9px] bg-[#D94E28] text-white px-2 py-0.5 font-bold uppercase tracking-widest">
          SLR Protocol
        </span>
      </div>

      {/* Right: Action Controls */}
      <div className="flex items-center gap-2 shrink-0">
        
        {/* Active Screening Indicator Capsule (if batch screening is running in background) */}
        {isScreening && aiProgress && (
          <button
            onClick={onOpenAiProgressModal}
            className="bg-[#2D1212] border border-[#DC2626] text-[#FCA5A5] hover:text-white px-2.5 py-1 text-xs font-mono font-bold flex items-center gap-1.5 animate-pulse transition-colors cursor-pointer"
            title="Click to reopen AI Screening Console"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D94E28] animate-spin" />
            <span>Screening {aiProgress?.percent ?? 0}% ({aiProgress?.evaluated ?? 0}/{aiProgress?.total ?? 0})</span>
          </button>
        )}

        {/* Harvest / Crawl Telemetry Console Reopen Button */}
        {harvestProgress && (
          <button
            onClick={onOpenHarvestProgressModal}
            className={`font-mono text-[11px] py-1.5 px-2.5 flex items-center gap-1.5 transition-colors font-bold shadow-2xs border cursor-pointer ${
              harvestProgress.isDone
                ? 'bg-[#24221F] hover:bg-[#33312E] text-[#38BDF8] border-[#38BDF8]/60'
                : 'bg-[#1E1B4B] text-[#818CF8] border-[#4F46E5] animate-pulse'
            }`}
            title="Reopen Harvest & Inline AI Screening Telemetry Console"
          >
            <Activity className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>
              {harvestProgress.isDone
                ? `Harvest Telemetry (${harvestProgress.rawCount || 0} papers)`
                : `Harvesting (${harvestProgress.stage})...`}
            </span>
          </button>
        )}

        {/* Protocol (PICO / IC / EC) Editor Button */}
        <button
          onClick={onOpenProtocolModal}
          className="bg-[#24221F] hover:bg-[#33312E] text-[#F4F1EA] border border-[#4A4843] hover:border-[#D94E28] font-mono text-[11px] py-1.5 px-2.5 flex items-center gap-1.5 transition-colors font-bold shadow-2xs cursor-pointer"
          title="View and customize PICO framework, Inclusion Criteria (IC), and Exclusion Criteria (EC)"
        >
          <Sliders className="w-3.5 h-3.5 text-[#D94E28]" />
          <span>Protocol ({icCount} IC / {ecCount} EC)</span>
        </button>

        {/* Import CSV Button */}
        <button
          onClick={onOpenCsvImport}
          className="bg-[#24221F] hover:bg-[#33312E] text-[#38BDF8] hover:text-white border border-[#4A4843] hover:border-[#38BDF8] font-mono text-[11px] py-1.5 px-2.5 flex items-center gap-1.5 transition-colors font-bold shadow-2xs cursor-pointer"
          title="Import external literature from CSV or BibTeX files with auto-deduplication"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span>Import CSV</span>
        </button>

        {/* AI Auto-Screen Button */}
        {!isScreening && (
          <button
            onClick={onOpenAiScreen}
            className="bg-[#D94E28] hover:bg-[#C4411C] text-white font-mono text-[11px] uppercase tracking-wider py-1.5 px-3 flex items-center gap-1.5 font-bold border border-[#A83416] transition-colors shadow-2xs cursor-pointer"
            title="Batch evaluate papers against PICO & IC/EC using Gemini AI"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Auto-Screen</span>
          </button>
        )}

        {/* Sync DB */}
        <button 
          onClick={onRefreshCorpus}
          disabled={isRefreshing}
          className="text-[#F4F1EA] bg-[#2C2B29] hover:bg-[#383633] border border-[#4A4843] flex items-center gap-1.5 font-mono text-[11px] py-1.5 px-2.5 transition-colors disabled:opacity-50 cursor-pointer"
          title="Refresh database records"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#D94E28]' : 'text-[#A09B8E]'}`} />
          <span>Sync</span>
        </button>

        {/* Git Config */}
        <button 
          onClick={onOpenGitSettings}
          className="text-[#F4F1EA] bg-[#2C2B29] hover:bg-[#383633] border border-[#4A4843] flex items-center gap-1.5 font-mono text-[11px] py-1.5 px-2.5 transition-colors cursor-pointer"
          title="Configure Git repository and token"
        >
          <GitCommit className="w-3.5 h-3.5 text-[#D94E28]" />
          <span>Git</span>
        </button>

        {/* Export Package */}
        <button 
          onClick={onOpenExportModal}
          className="bg-[#2D7A53] hover:bg-[#236142] text-white font-mono uppercase text-[11px] tracking-wider py-1.5 px-3 flex items-center gap-1.5 transition-all border border-[#1E5237] font-bold shadow-2xs cursor-pointer"
          title="Generate 6 SLR compliance files and 1-Click commit"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Package</span>
        </button>
      </div>

    </header>
  );
}
