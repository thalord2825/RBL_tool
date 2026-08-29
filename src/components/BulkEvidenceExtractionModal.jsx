import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Terminal,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Clock,
  ShieldCheck,
  Zap,
  Sliders,
  Check,
  Square
} from 'lucide-react';
import { apiClient, getStoredGeminiApiKey } from '../services/apiClient';

export default function BulkEvidenceExtractionModal({
  isOpen,
  onClose,
  paperIds = [],
  papers = [],
  onCompleted
}) {
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('auto');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [showTerminal, setShowTerminal] = useState(true);
  
  // Progress & Logs
  const [progress, setProgress] = useState({ current: 0, total: 0, percent: 0, currentTitle: '', statusText: '' });
  const [paperStatuses, setPaperStatuses] = useState({});
  const [logs, setLogs] = useState([]);
  
  const abortControllerRef = useRef(null);
  const terminalEndRef = useRef(null);

  // Initialize selected papers list
  useEffect(() => {
    if (isOpen) {
      const storedKey = getStoredGeminiApiKey();
      setApiKey(storedKey || '');
      
      const initialMap = {};
      paperIds.forEach(pid => {
        const pObj = papers.find(p => p.id === pid);
        initialMap[pid] = {
          id: pid,
          title: pObj?.title || 'Untitled Paper',
          authors: pObj?.authors || '',
          year: pObj?.year || 2024,
          venue: pObj?.venue || '',
          status: 'pending', // 'pending' | 'extracting' | 'success' | 'failed'
          evidence: null,
          duration_ms: null,
          error: null
        };
      });

      setPaperStatuses(initialMap);
      setProgress({
        current: 0,
        total: paperIds.length,
        percent: 0,
        currentTitle: '',
        statusText: `Ready to extract evidence for ${paperIds.length} selected papers.`
      });
      setLogs([{
        timestamp: new Date().toLocaleTimeString(),
        type: 'INFO',
        text: `Initialized batch extraction queue for ${paperIds.length} papers.`
      }]);
      setIsDone(false);
      setIsStreaming(false);
    }
  }, [isOpen, paperIds]);

  // Auto-scroll terminal
  useEffect(() => {
    if (showTerminal && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showTerminal]);

  const addLog = (type, text) => {
    setLogs(prev => [...prev.slice(-100), {
      timestamp: new Date().toLocaleTimeString(),
      type,
      text
    }]);
  };

  const handleStartExtraction = async (targetIds = paperIds) => {
    if (!apiKey.trim()) {
      alert('Please enter or configure your Google Gemini API Key first.');
      return;
    }

    setIsStreaming(true);
    setIsDone(false);
    abortControllerRef.current = new AbortController();

    addLog('INFO', `🚀 Starting batch extraction on ${targetIds.length} papers using model [${modelName}]...`);

    try {
      await apiClient.streamBulkExtractEvidence({
        paperIds: targetIds,
        apiKey: apiKey.trim(),
        modelName,
        projectId: 'default',
        delayMs: 350,
        signal: abortControllerRef.current.signal,
        onEvent: (data) => {
          if (data.event === 'batch_start') {
            setProgress(prev => ({
              ...prev,
              total: data.total,
              statusText: `Processing 0/${data.total}...`
            }));
          } else if (data.event === 'paper_start') {
            setPaperStatuses(prev => ({
              ...prev,
              [data.paper_id]: {
                ...prev[data.paper_id],
                status: 'extracting'
              }
            }));
            setProgress(prev => ({
              ...prev,
              current: data.index,
              percent: data.percent,
              currentTitle: data.title,
              statusText: `Extracting ${data.index}/${data.total}: [${data.paper_id}]`
            }));
          } else if (data.event === 'paper_success') {
            setPaperStatuses(prev => ({
              ...prev,
              [data.paper_id]: {
                ...prev[data.paper_id],
                status: 'success',
                evidence: data.evidence,
                duration_ms: data.duration_ms
              }
            }));
            setProgress(prev => ({
              ...prev,
              percent: data.percent
            }));
            if (data.log) addLog('SUCCESS', data.log);
          } else if (data.event === 'paper_error') {
            setPaperStatuses(prev => ({
              ...prev,
              [data.paper_id]: {
                ...prev[data.paper_id],
                status: 'failed',
                error: data.error
              }
            }));
            if (data.log) addLog('ERROR', data.log);
          } else if (data.event === 'batch_complete') {
            setIsDone(true);
            setIsStreaming(false);
            setProgress(prev => ({
              ...prev,
              percent: 100,
              statusText: `✓ Batch complete! ${data.total_success}/${data.total} succeeded in ${data.duration_s}s.`
            }));
            if (data.log) addLog('SUCCESS', data.log);
            if (onCompleted) {
              onCompleted();
            }
          } else if (data.event === 'log') {
            addLog('INFO', data.log);
          } else if (data.event === 'error') {
            addLog('ERROR', data.message || 'Unknown batch error');
            alert(`Batch error: ${data.message}`);
          }
        },
        onError: (err) => {
          addLog('ERROR', `Network stream error: ${err.message}`);
          setIsStreaming(false);
        }
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        addLog('ERROR', `Fatal execution error: ${err.message}`);
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      addLog('WARN', '⛔ User clicked Abort. Stopped batch pipeline cleanly.');
      setIsStreaming(false);
    }
  };

  const handleRetryFailed = () => {
    const failedIds = Object.values(paperStatuses)
      .filter(p => p.status === 'failed')
      .map(p => p.id);
    if (failedIds.length > 0) {
      handleStartExtraction(failedIds);
    }
  };

  if (!isOpen) return null;

  const successCount = Object.values(paperStatuses).filter(p => p.status === 'success').length;
  const failedCount = Object.values(paperStatuses).filter(p => p.status === 'failed').length;
  const pendingCount = Object.values(paperStatuses).filter(p => p.status === 'pending').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#FAF8F5] dark:bg-[#1C1B1A] border border-[#E6E2DE] dark:border-[#2E2C29] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 bg-white dark:bg-[#232220] border-b border-[#E6E2DE] dark:border-[#2E2C29] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/20">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#1A1917] dark:text-[#F5F3EF]">
                  Batch AI Evidence Extraction Engine
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                  {paperIds.length} Selected Papers
                </span>
              </div>
              <p className="text-xs text-[#706E6B] dark:text-[#A8A5A0]">
                Automated 7-Column Evidence Matrix Extraction under Zero Data Fabrication Policy
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            disabled={isStreaming}
            className="p-2 text-[#706E6B] hover:text-[#1A1917] dark:text-[#A8A5A0] dark:hover:text-[#F5F3EF] hover:bg-[#F0EDE8] dark:hover:bg-[#2E2C29] disabled:opacity-30 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Controls & API Key Card (Shown before run or during pause) */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#232220] border border-[#E6E2DE] dark:border-[#2E2C29] space-y-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              
              <div className="flex-1 min-w-[280px]">
                <label className="block text-[11px] font-bold text-[#706E6B] dark:text-[#A8A5A0] uppercase mb-1">
                  Google Gemini API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  disabled={isStreaming}
                  className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] dark:bg-[#1C1B1A] border border-[#E6E2DE] dark:border-[#2E2C29] rounded-lg text-[#1A1917] dark:text-[#F5F3EF] focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>

              <div className="w-48">
                <label className="block text-[11px] font-bold text-[#706E6B] dark:text-[#A8A5A0] uppercase mb-1">
                  AI Model
                </label>
                <select
                  value={modelName}
                  onChange={e => setModelName(e.target.value)}
                  disabled={isStreaming}
                  className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] dark:bg-[#1C1B1A] border border-[#E6E2DE] dark:border-[#2E2C29] rounded-lg text-[#1A1917] dark:text-[#F5F3EF] focus:outline-none focus:border-orange-500 font-mono"
                >
                  <option value="auto">⚡ Auto (Flash 2.0 ➔ 1.5-8b)</option>
                  <option value="models/gemini-2.0-flash">gemini-2.0-flash</option>
                  <option value="models/gemini-1.5-flash">gemini-1.5-flash</option>
                  <option value="models/gemini-1.5-flash-8b">gemini-1.5-flash-8b</option>
                  <option value="models/gemini-1.5-pro">gemini-1.5-pro</option>
                </select>
              </div>

              <div className="flex items-end gap-2 pt-4">
                {!isStreaming ? (
                  <button
                    onClick={() => handleStartExtraction(paperIds)}
                    className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    Start Batch Extraction ({paperIds.length})
                  </button>
                ) : (
                  <button
                    onClick={handleAbort}
                    className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer animate-pulse"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    Abort Extraction
                  </button>
                )}

                {isDone && failedCount > 0 && (
                  <button
                    onClick={handleRetryFailed}
                    disabled={isStreaming}
                    className="px-4 py-2 text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 dark:text-amber-300 dark:bg-amber-950/30 rounded-xl flex items-center gap-1.5 border border-amber-300 dark:border-amber-800 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Failed ({failedCount})
                  </button>
                )}
              </div>

            </div>
          </div>

          {/* Overall Progress Bar & Counter Stats */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#1A1917] dark:text-[#F5F3EF]">
              <div className="flex items-center gap-2">
                <span>Overall Progress:</span>
                <span className="font-mono text-orange-600 dark:text-orange-400 font-bold">
                  {progress.percent}%
                </span>
                <span className="text-[#706E6B] dark:text-[#A8A5A0] text-[11px]">
                  ({progress.statusText})
                </span>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {successCount} Success
                </span>
                {failedCount > 0 && (
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                    <XCircle className="w-3.5 h-3.5" /> {failedCount} Failed
                  </span>
                )}
                <span className="flex items-center gap-1 text-[#706E6B] dark:text-[#A8A5A0]">
                  <Clock className="w-3.5 h-3.5" /> {pendingCount} Pending
                </span>
              </div>
            </div>

            <div className="w-full bg-[#E6E2DE] dark:bg-[#2E2C29] h-2.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 transition-all duration-300 rounded-full"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>

          {/* Real-Time Paper List Grid */}
          <div className="bg-white dark:bg-[#232220] border border-[#E6E2DE] dark:border-[#2E2C29] rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 bg-[#FAF8F5] dark:bg-[#1C1B1A] border-b border-[#E6E2DE] dark:border-[#2E2C29] flex items-center justify-between text-xs font-bold text-[#706E6B] dark:text-[#A8A5A0] uppercase">
              <span>Paper Queue & Extraction Status ({paperIds.length})</span>
              <span>Zero Fabrication Compliant</span>
            </div>

            <div className="divide-y divide-[#E6E2DE] dark:divide-[#2E2C29] max-h-60 overflow-y-auto">
              {Object.values(paperStatuses).map((p, idx) => (
                <div key={p.id} className="p-3 flex items-center justify-between text-xs hover:bg-[#FAF8F5] dark:hover:bg-[#282725] transition-colors">
                  
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                    <span className="font-mono font-bold text-orange-600 dark:text-orange-400 text-[11px] shrink-0">
                      {p.id}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[#1A1917] dark:text-[#F5F3EF] truncate" title={p.title}>
                        {p.title}
                      </div>
                      <div className="text-[10px] text-[#706E6B] dark:text-[#A8A5A0] truncate">
                        {p.year} • {p.venue || 'Academic Venue'}
                        {p.evidence?.tool_model && p.evidence.tool_model !== 'N/A' && (
                          <span className="ml-2 font-mono text-emerald-600 dark:text-emerald-400">
                            • Model: {p.evidence.tool_model}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="shrink-0 flex items-center gap-2">
                    {p.status === 'pending' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#F0EDE8] dark:bg-[#2E2C29] text-[#706E6B] dark:text-[#A8A5A0]">
                        Pending ⏳
                      </span>
                    )}
                    {p.status === 'extracting' && (
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1.5 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Extracting...
                      </span>
                    )}
                    {p.status === 'success' && (
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Done ({p.duration_ms ? `${p.duration_ms}ms` : '✓'})
                      </span>
                    )}
                    {p.status === 'failed' && (
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center gap-1" title={p.error}>
                        <XCircle className="w-3 h-3" />
                        Failed
                      </span>
                    )}
                  </div>

                </div>
              ))}
            </div>
          </div>

          {/* Diagnostic Retro Terminal Console */}
          <div className="rounded-xl overflow-hidden border border-[#2E2C29] bg-[#1A1917] shadow-lg">
            <div className="px-4 py-2 bg-[#24221F] border-b border-[#2E2C29] flex items-center justify-between text-xs text-[#A8A5A0]">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-mono font-bold text-white">Live Batch Diagnostic Console</span>
                <span className="text-[10px] font-mono text-emerald-400">({logs.length} events)</span>
              </div>
              <button
                onClick={() => setShowTerminal(!showTerminal)}
                className="hover:text-white transition-colors"
              >
                {showTerminal ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {showTerminal && (
              <div className="p-3 font-mono text-[11px] max-h-44 overflow-y-auto space-y-1 bg-[#121110]">
                {logs.map((l, i) => (
                  <div key={i} className="leading-relaxed flex items-start gap-2">
                    <span className="text-[#605D58] shrink-0">{l.timestamp}</span>
                    <span
                      className={`break-all ${
                        l.type === 'SUCCESS'
                          ? 'text-emerald-400'
                          : l.type === 'ERROR'
                          ? 'text-red-400 font-bold'
                          : l.type === 'WARN'
                          ? 'text-amber-400'
                          : 'text-[#E6E2DE]'
                      }`}
                    >
                      {l.text}
                    </span>
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-[#FAF8F5] dark:bg-[#1C1B1A] border-t border-[#E6E2DE] dark:border-[#2E2C29] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-[#706E6B] dark:text-[#A8A5A0]">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>SQLite Auto-Persistence Enabled: Extracted records are saved directly to database.</span>
          </div>

          <div className="flex items-center gap-2">
            {isDone && (
              <button
                onClick={onClose}
                className="px-5 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all cursor-pointer"
              >
                ✓ Done & Close ({successCount} Papers)
              </button>
            )}
            {!isDone && (
              <button
                onClick={onClose}
                disabled={isStreaming}
                className="px-4 py-2 font-semibold text-[#1A1917] dark:text-[#F5F3EF] bg-white dark:bg-[#232220] border border-[#E6E2DE] dark:border-[#2E2C29] hover:bg-[#F0EDE8] dark:hover:bg-[#2E2C29] disabled:opacity-40 rounded-xl transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
