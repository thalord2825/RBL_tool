import React, { useState, useRef, useEffect } from 'react';
import { Terminal, ChevronUp, ChevronDown, Trash2, Copy, Check, Filter } from 'lucide-react';

export default function ActivityLogDrawer({ logs, onClearLogs }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [copied, setCopied] = useState(false);
  const logContainerRef = useRef(null);

  // Auto-scroll to bottom as new logs arrive
  useEffect(() => {
    if (isOpen && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  const handleCopyLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.type}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredLogs = logs.filter(log => {
    if (filterLevel === 'ALL') return true;
    return log.type === filterLevel;
  });

  const getTypeStyle = (type) => {
    switch (type) {
      case 'HARVEST':
        return 'text-[#38BDF8] bg-[#0C4A6E]/30 border-[#0284C7]';
      case 'DEDUP':
        return 'text-[#FBBF24] bg-[#78350F]/30 border-[#D97706]';
      case 'AI_SCREEN':
        return 'text-[#C084FC] bg-[#581C87]/30 border-[#9333EA]';
      case 'SUCCESS':
        return 'text-[#4ADE80] bg-[#14532D]/30 border-[#16A34A]';
      case 'ERROR':
      case 'TIMEOUT':
        return 'text-[#F87171] bg-[#7F1D1D]/30 border-[#DC2626]';
      default:
        return 'text-[#9CA3AF] bg-[#374151]/30 border-[#4B5563]';
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 font-mono text-xs select-none">
      
      {/* Collapsed Top Bar Trigger */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-[#181715] hover:bg-[#22211E] text-[#C8C1AE] border-t border-[#3D3A35] px-6 py-2 flex items-center justify-between cursor-pointer transition-colors shadow-lg"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[#D94E28] font-bold">
            <Terminal className="w-4 h-4" />
            <span className="uppercase tracking-wider text-[11px]">Research Telemetry & Activity Backlog</span>
          </div>
          <span className="bg-[#2A2825] text-[#A09B8E] px-2 py-0.5 rounded text-[10px]">
            {logs.length} events
          </span>
          {logs.length > 0 && (
            <span className="text-[11px] text-[#7A766F] truncate max-w-md hidden md:inline">
              Latest: {logs[logs.length - 1]?.message}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[#A09B8E]">
          <span className="text-[10px] uppercase font-bold">{isOpen ? 'Minimize Terminal' : 'Expand Logs'}</span>
          {isOpen ? <ChevronDown className="w-4 h-4 text-[#D94E28]" /> : <ChevronUp className="w-4 h-4" />}
        </div>
      </div>

      {/* Expanded Terminal Console Drawer */}
      {isOpen && (
        <div className="bg-[#121110] border-t border-[#2C2B29] h-64 flex flex-col shadow-2xl">
          
          {/* Controls Bar */}
          <div className="bg-[#1E1D1A] px-6 py-1.5 border-b border-[#2C2B29] flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-[#7A766F]" />
              <span className="text-[#7A766F]">Filter:</span>
              {['ALL', 'HARVEST', 'DEDUP', 'AI_SCREEN', 'SUCCESS', 'ERROR'].map(lvl => (
                <button
                  key={lvl}
                  onClick={(e) => { e.stopPropagation(); setFilterLevel(lvl); }}
                  className={`px-2 py-0.5 text-[10px] uppercase rounded transition-colors ${
                    filterLevel === lvl 
                      ? 'bg-[#D94E28] text-white font-bold' 
                      : 'bg-[#2A2825] text-[#A09B8E] hover:text-white'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleCopyLogs(); }}
                className="px-2 py-0.5 bg-[#2A2825] hover:bg-[#3D3A35] text-[#C8C1AE] flex items-center gap-1 rounded"
                title="Copy entire audit log to clipboard"
              >
                {copied ? <Check className="w-3 h-3 text-[#4ADE80]" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy Log'}</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onClearLogs(); }}
                className="px-2 py-0.5 bg-[#2A2825] hover:bg-[#3D3A35] text-[#F87171] flex items-center gap-1 rounded"
                title="Clear activity log"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Log Stream Body */}
          <div 
            ref={logContainerRef}
            className="flex-1 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1 bg-[#121110] text-[#E5E0D5]"
          >
            {filteredLogs.length === 0 ? (
              <div className="text-[#55524B] italic text-center py-8">
                No activity records in this view. Run search or AI screening to stream live telemetry.
              </div>
            ) : (
              filteredLogs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 hover:bg-[#1C1B18] px-1 py-0.5 rounded">
                  <span className="text-[#55524B] shrink-0 select-none">{log.timestamp}</span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border shrink-0 ${getTypeStyle(log.type)}`}>
                    {log.type}
                  </span>
                  <span className="text-[#D6D0C2] break-all">{log.message}</span>
                </div>
              ))
            )}
          </div>

        </div>
      )}

    </div>
  );
}
