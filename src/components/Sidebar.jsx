import React from 'react';
import { 
  BookOpen, 
  Search, 
  Layers, 
  CheckSquare, 
  Database, 
  Cpu, 
  HelpCircle, 
  Plus, 
  FolderCheck,
  Settings,
  GitCommit
} from 'lucide-react';

export default function Sidebar({ 
  projects, 
  activeProject, 
  setActiveProject, 
  onOpenProjectModal,
  onOpenGitSettings,
  onOpenPicoModal,
  collections,
  activeCollection,
  setActiveCollection
}) {
  return (
    <aside className="w-64 bg-[#EDE9DF] border-r border-[#DCD6C5] flex flex-col justify-between h-screen sticky top-0 text-[#1A1917] select-none text-xs font-sans">
      <div className="p-4 overflow-y-auto">
        {/* Logo / Header */}
        <div className="flex items-center gap-2 mb-6 pb-3 border-b border-[#DCD6C5]">
          <div className="w-7 h-7 bg-[#D94E28] text-white flex items-center justify-center font-serif text-lg font-bold">
            R
          </div>
          <div>
            <h1 className="font-serif text-base font-bold leading-none tracking-tight text-[#1A1917]">
              Research Intelligence
            </h1>
            <p className="font-mono text-[10px] text-[#7A766F] uppercase tracking-wider mt-0.5">
              RBL Workflow Protocol
            </p>
          </div>
        </div>

        {/* SECTION: DISCOVER */}
        <div className="mb-5">
          <div className="font-mono uppercase text-[10px] tracking-widest text-[#7A766F] mb-2 px-2">
            Discover
          </div>
          <nav className="space-y-0.5">
            <button className="w-full text-left px-2 py-1.5 rounded-none font-mono bg-[#E2DEC9] text-[#D94E28] font-semibold flex items-center gap-2 border-l-2 border-[#D94E28]">
              <BookOpen className="w-3.5 h-3.5" />
              <span>01 Brief</span>
            </button>
            <button className="w-full text-left px-2 py-1.5 rounded-none hover:bg-[#E5E0D3] text-[#4A4843] flex items-center gap-2 transition-colors">
              <Search className="w-3.5 h-3.5" />
              <span>02 Papers</span>
            </button>
            <button className="w-full text-left px-2 py-1.5 rounded-none hover:bg-[#E5E0D3] text-[#4A4843] flex items-center gap-2 transition-colors">
              <Layers className="w-3.5 h-3.5" />
              <span>03 Trends</span>
            </button>
          </nav>
        </div>

        {/* SECTION: CAPSTONE PROJECTS */}
        <div className="mb-5">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="font-mono uppercase text-[10px] tracking-widest text-[#7A766F]">
              Capstone Projects
            </span>
            <span className="font-mono text-[10px] bg-[#DCD6C5] px-1.5 py-0.5 text-[#4A4843]">
              {projects.length}
            </span>
          </div>

          <div className="space-y-1 mb-2">
            <button 
              onClick={onOpenProjectModal}
              className="w-full py-1.5 px-2 border border-dashed border-[#C8C1AE] hover:border-[#D94E28] text-[#D94E28] font-mono text-[11px] uppercase flex items-center justify-center gap-1 hover:bg-[#F4F1EA] transition-all"
            >
              <Plus className="w-3 h-3" />
              <span>+ New Search Rule</span>
            </button>
          </div>

          <div className="space-y-1">
            {projects.map((proj) => {
              const isActive = activeProject?.id === proj.id;
              return (
                <div
                  key={proj.id}
                  onClick={() => setActiveProject(proj)}
                  className={`p-2 cursor-pointer border transition-all ${
                    isActive 
                      ? 'bg-[#F8F6F0] border-[#D94E28] border-l-4' 
                      : 'bg-[#E5E0D3] border-[#DCD6C5] hover:border-[#C8C1AE]'
                  }`}
                >
                  <div className="font-bold text-[#1A1917] truncate">{proj.title}</div>
                  <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-[#7A766F]">
                    <span>{proj.rulesCount || proj.rules?.length || 0} RULES</span>
                    <span className="text-[#2D7A53] font-bold">● {proj.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION: WORKSPACE / COLLECTIONS */}
        <div className="mb-5">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="font-mono uppercase text-[10px] tracking-widest text-[#7A766F]">
              Collections ({collections.length})
            </span>
            <button onClick={onOpenPicoModal} className="text-[#D94E28] hover:underline font-mono text-[10px]">
              PICO Criteria
            </button>
          </div>
          
          <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
            {collections.map((col) => (
              <button
                key={col.id}
                onClick={() => setActiveCollection(col.id)}
                className={`w-full text-left px-2 py-1 text-[11px] font-mono truncate flex items-center justify-between transition-colors ${
                  activeCollection === col.id
                    ? 'bg-[#F8F6F0] text-[#1A1917] font-bold border-r-2 border-[#D94E28]'
                    : 'hover:bg-[#E5E0D3] text-[#4A4843]'
                }`}
              >
                <span className="truncate flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: col.color }}></span>
                  {col.name}
                </span>
                <span className="text-[10px] text-[#7A766F] font-mono ml-1">{col.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* SECTION: TOOLS & SETTINGS */}
        <div>
          <div className="font-mono uppercase text-[10px] tracking-widest text-[#7A766F] mb-1.5 px-2">
            Tools & Config
          </div>
          <nav className="space-y-0.5">
            <button 
              onClick={onOpenGitSettings}
              className="w-full text-left px-2 py-1.5 rounded-none hover:bg-[#E5E0D3] text-[#1A1917] font-mono text-[11px] flex items-center gap-2"
            >
              <GitCommit className="w-3.5 h-3.5 text-[#D94E28]" />
              <span>Git Commit Config</span>
            </button>
            <button 
              onClick={onOpenPicoModal}
              className="w-full text-left px-2 py-1.5 rounded-none hover:bg-[#E5E0D3] text-[#1A1917] font-mono text-[11px] flex items-center gap-2"
            >
              <CheckSquare className="w-3.5 h-3.5 text-[#2D7A53]" />
              <span>PICO + IC/EC Config</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="p-3 border-t border-[#DCD6C5] bg-[#E2DEC9] text-[10px] font-mono text-[#7A766F] flex items-center justify-between">
        <div>
          <div className="text-[#1A1917] font-semibold">Curated for RBL</div>
          <div>ScamShield Protocol</div>
        </div>
        <div className="w-2 h-2 rounded-full bg-[#2D7A53] animate-pulse"></div>
      </div>
    </aside>
  );
}
