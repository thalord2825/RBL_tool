import React, { useState, useEffect, useCallback } from 'react';
import TopHeader from './components/TopHeader';
import SearchQueryBar from './components/SearchQueryBar';
import EvidenceTable from './components/EvidenceTable';
import ExclusionReasonModal from './components/ExclusionReasonModal';
import EvidenceExtractionModal from './components/EvidenceExtractionModal';
import AiScreenModal from './components/AiScreenModal';
import AiScreenProgressModal from './components/AiScreenProgressModal';
import HarvestProgressModal from './components/HarvestProgressModal';
import ActivityLogDrawer from './components/ActivityLogDrawer';
import DuplicateCompareModal from './components/DuplicateCompareModal';
import GitCommitSettingsModal from './components/GitCommitSettingsModal';
import ExportModal from './components/ExportModal';
import ProtocolSettingsModal, { DEFAULT_PICO, DEFAULT_IC_LIST, DEFAULT_EC_LIST } from './components/ProtocolSettingsModal';
import AiScreenMiniDock from './components/AiScreenMiniDock';
import CsvImportModal from './components/CsvImportModal';
import AddPaperManualModal from './components/AddPaperManualModal';

import { apiClient, getStoredGeminiApiKey } from './services/apiClient';

export default function App() {
  // Corpus & Search State
  const [papers, setPapers] = useState([]);
  const [query, setQuery] = useState(
    '("phishing" OR "smishing" OR "scam message") AND ("few-shot" OR "prompt-based" OR "LLM") AND ("fine-tuning" OR "PhoBERT" OR "BERT")'
  );
  const [sources, setSources] = useState(['ArXiv', 'OpenAlex', 'Semantic Scholar', 'CrossRef', 'Google Scholar']);
  const [sinceYear, setSinceYear] = useState(2020);
  const [researchContext, setResearchContext] = useState(
    'Prioritize Vietnamese SMS/Zalo/Messenger phishing and scam datasets. If scarce, accept Southeast Asian and international mobile phishing studies with transferable NLP/LLM classification architectures (relax strict Vietnam-only constraint).'
  );
  const [autoScreenOnHarvest, setAutoScreenOnHarvest] = useState(false);
  const [autoScreenModel, setAutoScreenModel] = useState('gemini-2.0-flash');
  const [discardExcludedOnHarvest, setDiscardExcludedOnHarvest] = useState(false);
  
  // UI & Loading State
  const [isLoading, setIsLoading] = useState(false);
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [isScreening, setIsScreening] = useState(false);

  // Modals & Real-Time Streaming State
  const [excludingPaper, setExcludingPaper] = useState(null);
  const [extractingPaper, setExtractingPaper] = useState(null);
  const [isAiScreenModalOpen, setIsAiScreenModalOpen] = useState(false);
  const [isProtocolModalOpen, setIsProtocolModalOpen] = useState(false);
  const [duplicatePair, setDuplicatePair] = useState(null); // { paperA, paperB }
  const [isGitSettingsOpen, setIsGitSettingsOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCsvImportModalOpen, setIsCsvImportModalOpen] = useState(false);
  const [isAddPaperModalOpen, setIsAddPaperModalOpen] = useState(false);

  // Real-Time Streaming Progress
  const [harvestProgress, setHarvestProgress] = useState(null);
  const [isHarvestModalOpen, setIsHarvestModalOpen] = useState(false);
  const [aiProgress, setAiProgress] = useState(null);
  const [isAiProgressModalOpen, setIsAiProgressModalOpen] = useState(false);

  // Live Activity Logs Drawer State
  const [logs, setLogs] = useState([
    {
      timestamp: new Date().toLocaleTimeString(),
      type: 'SUCCESS',
      message: 'RBL Research Intelligence Web App initialized. SQLite backend connected.'
    }
  ]);

  const addLog = useCallback((type, message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-199), { timestamp, type, message }]);
  }, []);

  // Research Protocol State (PICO & Criteria) with Persistent Storage
  const [pico, setPico] = useState(() => {
    const saved = localStorage.getItem('rbl_research_protocol');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.pico && parsed.pico.P && !parsed.pico.P.includes('financial scam message text lures')) return parsed.pico;
      } catch (e) {}
    }
    return DEFAULT_PICO;
  });

  const [icList, setIcList] = useState(() => {
    const saved = localStorage.getItem('rbl_research_protocol');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.icList) && parsed.icList.length > 0 && !parsed.icList[0].includes('bug reports')) {
          return parsed.icList;
        }
      } catch (e) {}
    }
    return DEFAULT_IC_LIST;
  });

  const [ecList, setEcList] = useState(() => {
    const saved = localStorage.getItem('rbl_research_protocol');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.ecList) && parsed.ecList.length > 0 && !parsed.ecList[0].includes('bug reports')) {
          return parsed.ecList;
        }
      } catch (e) {}
    }
    return DEFAULT_EC_LIST;
  });

  // Table Multi-Select & Filter State tracked for Context-Aware AI Screening
  const [selectedPaperIds, setSelectedPaperIds] = useState(new Set());
  const [currentFilterStage, setCurrentFilterStage] = useState('ALL');
  const [filteredPaperIds, setFilteredPaperIds] = useState([]);

  // Git Settings (Persisted in localStorage)
  const [gitSettings, setGitSettings] = useState(() => {
    const saved = localStorage.getItem('rbl_git_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      repoOwner: 'QuangWorkIT',
      repoName: 'RBL_ScamShield',
      branch: 'main',
      memberPath: 'trung_hieu/SLR/',
      commitPrefix: '[SLR]',
      authorName: 'Nguyen Trung Hieu',
      githubToken: ''
    };
  });

  // Load papers and protocol on mount
  useEffect(() => {
    fetchPapers();
    fetchProtocol();
  }, []);

  const fetchPapers = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.getPapers('default');
      setPapers(res.papers || []);
      addLog('SUCCESS', `Loaded ${res.count || 0} papers from SQLite corpus.`);
    } catch (err) {
      addLog('ERROR', `Backend connection warning: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProtocol = async () => {
    try {
      const res = await apiClient.getProtocol('default');
      if (res && res.pico && Object.keys(res.pico).length > 0) {
        setPico(res.pico);
        if (res.ic_list?.length > 0) setIcList(res.ic_list);
        if (res.ec_list?.length > 0) setEcList(res.ec_list);
      }
    } catch (err) {
      console.warn('Could not sync protocol from server, using local storage.');
    }
  };

  // Save and Propagate Protocol
  const handleSaveProtocol = async ({ pico: newPico, icList: newIcList, ecList: newEcList }) => {
    setPico(newPico);
    setIcList(newIcList);
    setEcList(newEcList);

    // Save to local storage
    localStorage.setItem('rbl_research_protocol', JSON.stringify({
      pico: newPico,
      icList: newIcList,
      ecList: newEcList
    }));

    // Save to SQLite
    try {
      await apiClient.saveProtocol({
        projectId: 'default',
        pico: newPico,
        icList: newIcList,
        ecList: newEcList
      });
      addLog('SUCCESS', `Protocol updated: ${newIcList.length} ICs, ${newEcList.length} ECs saved to SQLite.`);
    } catch (err) {
      addLog('WARN', `Saved protocol locally (server sync warning: ${err.message})`);
    }
  };

  // Real-Time Streaming Metadata Harvest with Explicit Mode & Live Telemetry
  const handleHarvest = async (withAiScreen = false) => {
    if (!query.trim()) return;
    setIsHarvesting(true);
    setIsHarvestModalOpen(true);
    
    setHarvestProgress({
      sources,
      sourceStatus: {},
      rawCount: 0,
      dedupCount: 0,
      uniqueCount: 0,
      isDone: false,
      duration: 0,
      stage: 'CRAWL',
      autoScreen: withAiScreen,
      modelName: autoScreenModel,
      screenedCount: 0,
      totalToScreen: 0,
      screenLogs: [],
      aiStats: { INCLUDED: 0, EXCLUDED: 0, UNSURE: 0 }
    });

    addLog('HARVEST', `Starting parallel multi-source crawl across [${sources.join(', ')}] (AI Screening: ${withAiScreen ? 'ON' : 'OFF'})...`);

    try {
      await apiClient.streamHarvestPapers({
        query,
        sources,
        sinceYear,
        limitPerSource: 25,
        projectId: 'default',
        autoScreen: withAiScreen,
        researchContext,
        apiKey: getStoredGeminiApiKey() || null,
        modelName: autoScreenModel,
        discardExcluded: discardExcludedOnHarvest,
        onEvent: (eventData) => {
          if (!eventData || !eventData.event) return;

          if (eventData.event === 'stage_change') {
            setHarvestProgress(prev => ({
              ...prev,
              stage: eventData.stage,
              ...(eventData.raw_count ? { rawCount: eventData.raw_count } : {}),
              ...(eventData.count ? { totalToScreen: eventData.count } : {})
            }));
          } else if (eventData.event === 'source_done') {
            const { source, count, status, error, duration_sec } = eventData;
            setHarvestProgress(prev => ({
              ...prev,
              sourceStatus: {
                ...prev.sourceStatus,
                [source]: { count, status, error, duration_sec }
              }
            }));
            if (status === 'ok') {
              addLog('HARVEST', `[${source}] Harvested ${count} papers (${duration_sec}s).`);
            } else {
              addLog('WARN', `[${source}] Skipped/Error: ${error}`);
            }
          } else if (eventData.event === 'dedup_start') {
            addLog('DEDUP', `Starting deduplication on ${eventData.raw_count} raw records...`);
          } else if (eventData.event === 'stage_warning') {
            addLog('WARN', `[${eventData.stage}] ${eventData.message}`);
          } else if (eventData.event === 'inline_screen_start') {
            addLog('AI_SCREEN', `⚡ Auto-Screening ${eventData.count} harvested papers using ${eventData.model}...`);
          } else if (eventData.event === 'ai_warning') {
            setHarvestProgress(prev => ({ ...prev, aiWarning: eventData.message }));
            addLog('WARN', `AI Screening: ${eventData.message}`);
          } else if (eventData.event === 'ai_rate_limit') {
            setHarvestProgress(prev => ({
              ...prev,
              rateLimitNotice: eventData.message,
              coolingModels: eventData.cooling_models || prev?.coolingModels
            }));
            addLog('WARN', `Circuit Breaker: ${eventData.message}`);
          } else if (eventData.event === 'paper_screened') {
            setHarvestProgress(prev => ({
              ...prev,
              screenedCount: eventData.screened_count || (prev.screenedCount + 1),
              totalToScreen: eventData.total_to_screen || prev.totalToScreen,
              aiStats: eventData.ai_stats || prev.aiStats,
              activeModel: eventData.active_model || prev.activeModel,
              coolingModels: eventData.cooling_models || prev.coolingModels,
              screenLogs: [...(prev.screenLogs || []).slice(-29), eventData]
            }));
            addLog('AI_SCREEN', `[${eventData.paper_id}] ${eventData.decision} (${Math.round((eventData.confidence || 0.8) * 100)}%) — "${eventData.title}..."`);
          } else if (eventData.event === 'complete') {
            setPapers(eventData.papers || []);
            setHarvestProgress(prev => ({
              ...prev,
              rawCount: eventData.harvested_count,
              dedupCount: eventData.duplicates_filtered,
              uniqueCount: eventData.new_added,
              aiStats: eventData.ai_stats || prev.aiStats,
              isDone: true,
              duration: eventData.duration_sec,
              stage: 'COMPLETE'
            }));
            addLog('SUCCESS', `Harvest complete: +${eventData.new_added} unique papers added, ${eventData.duplicates_filtered} duplicates filtered (${eventData.duration_sec}s).`);
          }
        },
        onError: (err) => {
          addLog('ERROR', `Harvest stream error: ${err.message}`);
          setHarvestProgress(prev => ({
            ...prev,
            isDone: true,
            stage: 'ERROR',
            error: err.message
          }));
          fetchPapers();
        }
      });
    } catch (err) {
      addLog('ERROR', `Harvest failed: ${err.message}`);
      setHarvestProgress(prev => ({
        ...prev,
        isDone: true,
        stage: 'ERROR',
        error: err.message
      }));
      fetchPapers();
    } finally {
      setIsHarvesting(false);
    }
  };

  // Real-Time Streaming AI Screening (Micro-Batching + Incremental SQLite Updates)
  const handleRunAiScreen = async ({ apiKey, modelName, pico: picoInput, icList: icInput, ecList: ecInput, scope, paperIds: customPaperIds }) => {
    setIsScreening(true);
    setIsAiScreenModalOpen(false);
    setIsAiProgressModalOpen(true);

    let targetIds = null;
    if (Array.isArray(customPaperIds)) {
      targetIds = customPaperIds;
    } else if (scope === 'PENDING' || scope === 'PENDING_ONLY' || customPaperIds === 'PENDING') {
      targetIds = papers.filter(p => p && (p.status === 'PENDING' || !p.ai_decision)).map(p => p.id);
    } else if (scope === 'CURRENT_TAB' && Array.isArray(filteredPaperIds) && filteredPaperIds.length > 0) {
      targetIds = filteredPaperIds;
    } else if (scope === 'TICKED_ONLY' && selectedPaperIds.size > 0) {
      targetIds = Array.from(selectedPaperIds);
    } else {
      targetIds = null; // signals backend to screen entire corpus
    }

    const totalToScreen = targetIds ? targetIds.length : (papers?.length || 0);

    const initialProgress = {
      total: totalToScreen,
      evaluated: 0,
      percent: 0,
      currentTitle: '',
      currentId: '',
      lastDecision: null,
      lastConfidence: 0,
      lastRationale: '',
      stats: { INCLUDED: 0, EXCLUDED: 0, UNSURE: 0 },
      eta: 0,
      activeModel: modelName || 'Auto-Discover',
      isDone: false,
      evalLogs: []
    };

    setAiProgress(initialProgress);

    addLog('AI_SCREEN', `Launching Gemini AI Micro-Batch screening for ${totalToScreen} papers...`);

    try {
      await apiClient.streamAiScreenPapers({
        apiKey,
        modelName,
        pico: picoInput || pico,
        icList: icInput || icList,
        ecList: ecInput || ecList,
        paperIds: targetIds,
        projectId: 'default',
        onEvent: (eventData) => {
          if (!eventData || !eventData.event) return;

          if (eventData.event === 'init') {
            addLog('AI_SCREEN', `Initialized ${eventData.total_chunks} micro-batches with model [${eventData.active_model}].`);
            setAiProgress(prev => ({
              ...(prev || initialProgress),
              total: eventData.total_papers || prev?.total || totalToScreen,
              activeModel: eventData.active_model || 'Gemini Flash'
            }));
          } else if (eventData.event === 'ai_rate_limit') {
            setAiProgress(prev => ({
              ...prev,
              rateLimitNotice: eventData.message,
              coolingModels: eventData.cooling_models || prev?.coolingModels
            }));
            addLog('WARN', `Circuit Breaker: ${eventData.message}`);
          } else if (eventData.event === 'chunk_start') {
            addLog('AI_SCREEN', `Processing chunk ${eventData.chunk_idx}/${eventData.total_chunks} (${eventData.chunk_size} papers)...`);
            setAiProgress(prev => ({
              ...(prev || initialProgress),
              currentChunk: eventData.chunk_idx,
              totalChunks: eventData.total_chunks,
              activeModel: eventData.active_model || prev?.activeModel,
              coolingModels: eventData.cooling_models || prev?.coolingModels
            }));
          } else if (eventData.event === 'paper_evaluated') {
            const { 
              paper_id = '', 
              title = '', 
              year = '', 
              source = '', 
              decision = 'UNSURE', 
              confidence = 0.85, 
              exclusion_reason = null, 
              rationale = '', 
              matched_criteria = [], 
              raw_json = null, 
              latency_seconds = 0, 
              evaluated_count = 0, 
              total_papers = totalToScreen, 
              progress_percent = 0, 
              stats = { INCLUDED: 0, EXCLUDED: 0, UNSURE: 0 }, 
              eta_seconds = 0 
            } = eventData;

            // Live update individual paper in table immediately
            setPapers(prevPapers => (prevPapers || []).map(p => {
              if (p && p.id === paper_id) {
                const newStatus = decision === 'EXCLUDED' ? 'EXCLUDED' : decision === 'INCLUDED' ? 'INCLUDED' : p.status;
                return {
                  ...p,
                  status: newStatus,
                  exclusion_reason: exclusion_reason || p.exclusion_reason,
                  ai_decision: decision,
                  ai_confidence: confidence,
                  ai_rationale: rationale
                };
              }
              return p;
            }));

            // Update Progress Modal & Real-time Live Log
            setAiProgress(prev => {
              const base = prev || initialProgress;
              const currentLogs = Array.isArray(base.evalLogs) ? base.evalLogs : [];
              const newLogEntry = {
                paper_id,
                title,
                year,
                source,
                decision,
                confidence,
                exclusion_reason,
                rationale,
                matched_criteria: Array.isArray(matched_criteria) ? matched_criteria : [matched_criteria].filter(Boolean),
                raw_json: raw_json || { id: paper_id, decision, confidence, rationale },
                latency_seconds
              };

              return {
                ...base,
                evaluated: evaluated_count,
                percent: progress_percent,
                currentTitle: title,
                currentId: paper_id,
                lastDecision: decision,
                lastConfidence: confidence,
                lastRationale: rationale,
                stats: stats || base.stats || { INCLUDED: 0, EXCLUDED: 0, UNSURE: 0 },
                eta: eta_seconds,
                evalLogs: [...currentLogs, newLogEntry]
              };
            });

            addLog('AI_SCREEN', `[${paper_id}] ${decision} (${Math.round(confidence * 100)}%) — "${title.slice(0, 45)}..."`);
          } else if (eventData.event === 'chunk_done') {
            addLog('SUCCESS', `Chunk ${eventData.chunk_idx}/${eventData.total_chunks} committed to SQLite (${eventData.duration_sec}s).`);
          } else if (eventData.event === 'complete') {
            if (Array.isArray(eventData.papers)) {
              setPapers(eventData.papers);
            }
            setAiProgress(prev => ({
              ...(prev || initialProgress),
              evaluated: eventData.evaluated_count || prev?.evaluated || totalToScreen,
              percent: 100,
              stats: eventData.stats || prev?.stats || { INCLUDED: 0, EXCLUDED: 0, UNSURE: 0 },
              isDone: true
            }));
            addLog('SUCCESS', `AI Screening completed for ${eventData.evaluated_count || totalToScreen} papers in ${eventData.total_duration_sec || 0}s!`);
          } else if (eventData.event === 'error') {
            addLog('ERROR', `AI Screening error: ${eventData.message}`);
          }
        },
        onError: (err) => {
          addLog('ERROR', `AI Screening stream failure: ${err.message}`);
          alert(`AI Screening failed: ${err.message}`);
        }
      });
    } catch (err) {
      addLog('ERROR', `AI Screening exception: ${err.message}`);
    } finally {
      setIsScreening(false);
    }
  };

  const handleOpenDuplicateCompare = (paperA, targetId) => {
    const paperB = papers.find(p => p.id === targetId);
    if (paperB) {
      setDuplicatePair({ paperA, paperB });
    }
  };

  const handleMergeDuplicates = async (keepId, removeId) => {
    try {
      const res = await apiClient.mergeDuplicates({ keepId, removeId });
      setPapers(res.papers || []);
      setDuplicatePair(null);
      addLog('DEDUP', `Merged duplicate: Kept [${keepId}], removed [${removeId}].`);
    } catch (err) {
      addLog('ERROR', `Merge failed: ${err.message}`);
      alert(`Merge failed: ${err.message}`);
    }
  };

  const handleDismissDuplicate = async (paperId) => {
    try {
      await apiClient.updatePaper(paperId, {
        duplicate_flag: false,
        duplicate_with_id: null,
        duplicate_reason: null
      });
      setPapers(prev => prev.map(p => p.id === paperId ? { ...p, duplicate_flag: false } : p));
      setDuplicatePair(null);
      addLog('DEDUP', `Dismissed duplicate flag on [${paperId}].`);
    } catch (err) {
      addLog('ERROR', `Failed to dismiss duplicate: ${err.message}`);
    }
  };

  const handleUpdateStatus = async (paperId, updates) => {
    try {
      const updated = await apiClient.updatePaper(paperId, updates);
      setPapers(prev => prev.map(p => p.id === paperId ? updated : p));
      addLog('SUCCESS', `Updated status on [${paperId}] -> ${updates.status || 'saved'}.`);
    } catch (err) {
      addLog('ERROR', `Failed to update paper [${paperId}]: ${err.message}`);
    }
  };

  const handleConfirmExclusion = async (paperId, rationale) => {
    try {
      const updated = await apiClient.updatePaper(paperId, {
        status: 'EXCLUDED',
        exclusion_reason: rationale
      });
      setPapers(prev => prev.map(p => p.id === paperId ? updated : p));
      addLog('WARN', `Excluded [${paperId}] with reason: ${rationale}`);
    } catch (err) {
      addLog('ERROR', `Failed to exclude paper: ${err.message}`);
    }
  };

  const handleSaveExtraction = async (paperId, extractionData) => {
    try {
      const updated = await apiClient.updatePaper(paperId, {
        ...extractionData,
        status: 'INCLUDED'
      });
      setPapers(prev => prev.map(p => p.id === paperId ? updated : p));
      addLog('SUCCESS', `Saved 7-column evidence extraction for [${paperId}].`);
    } catch (err) {
      addLog('ERROR', `Failed to save extraction: ${err.message}`);
    }
  };

  const handleDeletePaper = async (paperId) => {
    if (!window.confirm(`Delete paper ${paperId} from corpus?`)) return;
    try {
      await apiClient.deletePaper(paperId);
      setPapers(prev => prev.filter(p => p.id !== paperId));
      addLog('WARN', `Deleted paper [${paperId}] from corpus.`);
    } catch (err) {
      addLog('ERROR', `Failed to delete paper: ${err.message}`);
    }
  };

  const handleBulkUpdateStatus = async (paperIds, updates) => {
    // Optimistic UI update
    setPapers(prev => prev.map(p => {
      if (paperIds.includes(p.id)) {
        return {
          ...p,
          ...updates,
          status: updates.status || p.status,
          exclusion_reason: updates.exclusion_reason !== undefined ? updates.exclusion_reason : p.exclusion_reason
        };
      }
      return p;
    }));

    try {
      const res = await apiClient.bulkUpdatePapers({
        paperIds,
        updates,
        projectId: 'default'
      });
      if (res.papers) {
        setPapers(res.papers);
      }
      addLog('SUCCESS', `Bulk updated ${paperIds.length} papers -> ${updates.status || 'saved'}.`);
    } catch (err) {
      addLog('ERROR', `Failed bulk update: ${err.message}`);
      fetchPapers();
    }
  };

  const handleBulkDeletePapers = async (paperIds) => {
    // Optimistic UI update
    setPapers(prev => prev.filter(p => !paperIds.includes(p.id)));

    try {
      const res = await apiClient.bulkDeletePapers({
        paperIds,
        projectId: 'default'
      });
      if (res.papers) {
        setPapers(res.papers);
      }
      addLog('WARN', `Bulk deleted ${paperIds.length} papers from corpus.`);
    } catch (err) {
      addLog('ERROR', `Failed bulk delete: ${err.message}`);
      fetchPapers();
    }
  };

  const handleBulkAiScreen = (selectedIds) => {
    setIsAiScreenModalOpen(true);
  };

  const handleSaveGitSettings = (newSettings) => {
    setGitSettings(newSettings);
    localStorage.setItem('rbl_git_settings', JSON.stringify(newSettings));
    addLog('SUCCESS', 'Git configuration saved to local storage.');
  };

  // Metrics
  const includedCount = papers.filter(p => p.status === 'INCLUDED').length;
  const pendingCount = papers.filter(p => p.status === 'PENDING').length;
  const excludedCount = papers.filter(p => p.status === 'EXCLUDED').length;
  const unsureCount = papers.filter(p => p.ai_decision === 'UNSURE').length;
  const duplicatesCount = papers.filter(p => p.duplicate_flag).length;
  const extractedCount = papers.filter(p => p.status === 'INCLUDED' && p.tool_model && p.tool_model !== 'N/A').length;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F4F1EA] text-[#1A1917] font-sans antialiased pb-10">
      
      {/* Top Header with Compact PRISMA Capsule & Protocol Button */}
      <TopHeader
        totalCount={papers.length}
        includedCount={includedCount}
        excludedCount={excludedCount}
        pendingCount={pendingCount}
        unsureCount={unsureCount}
        duplicatesCount={duplicatesCount}
        extractedCount={extractedCount}
        icCount={icList.length}
        ecCount={ecList.length}
        isScreening={isScreening}
        aiProgress={aiProgress}
        harvestProgress={harvestProgress}
        onOpenHarvestProgressModal={() => setIsHarvestModalOpen(true)}
        onOpenAiScreen={() => setIsAiScreenModalOpen(true)}
        onOpenAiProgressModal={() => setIsAiProgressModalOpen(true)}
        onOpenProtocolModal={() => setIsProtocolModalOpen(true)}
        onOpenCsvImport={() => setIsCsvImportModalOpen(true)}
        onOpenAddPaper={() => setIsAddPaperModalOpen(true)}
        onOpenGitSettings={() => setIsGitSettingsOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onRefreshCorpus={fetchPapers}
        isRefreshing={isLoading}
      />

      {/* Streamlined Query & Source Control Bar */}
      <SearchQueryBar
        query={query}
        setQuery={setQuery}
        sources={sources}
        setSources={setSources}
        sinceYear={sinceYear}
        setSinceYear={setSinceYear}
        researchContext={researchContext}
        setResearchContext={setResearchContext}
        autoScreenOnHarvest={autoScreenOnHarvest}
        setAutoScreenOnHarvest={setAutoScreenOnHarvest}
        autoScreenModel={autoScreenModel}
        setAutoScreenModel={setAutoScreenModel}
        discardExcludedOnHarvest={discardExcludedOnHarvest}
        setDiscardExcludedOnHarvest={setDiscardExcludedOnHarvest}
        onHarvest={handleHarvest}
        isHarvesting={isHarvesting}
        harvestProgress={harvestProgress}
        onOpenHarvestModal={() => setIsHarvestModalOpen(true)}
      />

      {/* Main Evidence Screening Matrix with Multi-Select & Floating Batch Dock */}
      <EvidenceTable
        papers={papers}
        onUpdateStatus={handleUpdateStatus}
        onRequestExclude={(paper) => setExcludingPaper(paper)}
        onOpenExtraction={(paper) => setExtractingPaper(paper)}
        onDeletePaper={handleDeletePaper}
        onOpenDuplicateCompare={handleOpenDuplicateCompare}
        onBulkUpdateStatus={handleBulkUpdateStatus}
        onBulkDeletePapers={handleBulkDeletePapers}
        onBulkAiScreen={handleBulkAiScreen}
        onUpdatePaper={(updated) => setPapers(prev => prev.map(p => p.id === updated.id ? updated : p))}
        onBulkPapersUpdate={(newPapers) => setPapers(newPapers)}
        ecList={ecList}
        selectedPaperIds={selectedPaperIds}
        onSelectionChange={setSelectedPaperIds}
        onFilterChange={({ filterStage, filteredPaperIds }) => {
          setCurrentFilterStage(filterStage);
          setFilteredPaperIds(filteredPaperIds);
        }}
      />

      {/* Research Protocol Manager Modal (PICO + IC + EC) */}
      <ProtocolSettingsModal
        isOpen={isProtocolModalOpen}
        onClose={() => setIsProtocolModalOpen(false)}
        pico={pico}
        icList={icList}
        ecList={ecList}
        onSaveProtocol={handleSaveProtocol}
      />

      {/* Mandatory Exclusion Modal (Dynamic ECs) */}
      <ExclusionReasonModal
        isOpen={!!excludingPaper}
        onClose={() => setExcludingPaper(null)}
        paper={excludingPaper}
        onConfirmExclusion={handleConfirmExclusion}
        ecList={ecList}
      />

      {/* Grounded Evidence Extraction Modal */}
      <EvidenceExtractionModal
        isOpen={!!extractingPaper}
        onClose={() => setExtractingPaper(null)}
        paper={extractingPaper}
        onSaveExtraction={handleSaveExtraction}
      />

      {/* Gemini AI Auto-Screen Configuration Modal (4-Tier Contextual Scope Selector) */}
      <AiScreenModal
        isOpen={isAiScreenModalOpen}
        onClose={() => setIsAiScreenModalOpen(false)}
        pico={pico}
        icList={icList}
        ecList={ecList}
        onRunAiScreen={handleRunAiScreen}
        onOpenProtocolModal={() => setIsProtocolModalOpen(true)}
        isScreening={isScreening}
        totalPapersCount={papers.length}
        pendingCount={pendingCount}
        selectedPaperIds={selectedPaperIds}
        filteredPaperIds={filteredPaperIds}
        currentFilterStage={currentFilterStage}
      />

      {/* Real-Time AI Screening Live Progress Modal */}
      <AiScreenProgressModal
        isOpen={isAiProgressModalOpen}
        progress={aiProgress}
        onClose={() => setIsAiProgressModalOpen(false)}
        onMinimize={() => setIsAiProgressModalOpen(false)}
      />

      {/* CSV / BibTeX Paper Ingestion Modal */}
      <CsvImportModal
        isOpen={isCsvImportModalOpen}
        onClose={() => setIsCsvImportModalOpen(false)}
        onImportSuccess={(res) => {
          if (res && res.papers) {
            setPapers(res.papers);
          } else {
            fetchPapers();
          }
          addLog('SUCCESS', `CSV Ingestion: +${res.new_added || 0} unique papers added (${res.duplicates_filtered || 0} duplicates filtered).`);
        }}
      />

      {/* Manual / DOI Paper Entry Modal */}
      <AddPaperManualModal
        isOpen={isAddPaperModalOpen}
        onClose={() => setIsAddPaperModalOpen(false)}
        onPaperAdded={(savedPaper, updatedPapersList, isDuplicate) => {
          if (Array.isArray(updatedPapersList)) {
            setPapers(updatedPapersList);
          } else if (savedPaper) {
            setPapers(prev => [savedPaper, ...(prev || [])]);
          }
          if (isDuplicate) {
            addLog('WARN', `Added paper [${savedPaper?.id || 'P'}] "${savedPaper?.title?.slice(0, 45)}..." (Flagged as potential duplicate).`);
          } else {
            addLog('SUCCESS', `Added paper [${savedPaper?.id || 'P'}] "${savedPaper?.title?.slice(0, 45)}..." to corpus.`);
          }
        }}
      />

      {/* Real-Time Multi-Source Harvest Progress Modal */}
      <HarvestProgressModal
        isOpen={isHarvestModalOpen}
        progress={harvestProgress}
        onClose={() => setIsHarvestModalOpen(false)}
        onOpenAiScreenPending={() => {
          setIsHarvestModalOpen(false);
          setIsAiScreenModalOpen(true);
        }}
      />

      {/* Duplicate Compare & Merge Modal */}
      <DuplicateCompareModal
        isOpen={!!duplicatePair}
        onClose={() => setDuplicatePair(null)}
        paperA={duplicatePair?.paperA}
        paperB={duplicatePair?.paperB}
        onMerge={handleMergeDuplicates}
        onDismiss={handleDismissDuplicate}
      />

      {/* Git Configuration Modal */}
      <GitCommitSettingsModal
        isOpen={isGitSettingsOpen}
        onClose={() => setIsGitSettingsOpen(false)}
        gitSettings={gitSettings}
        onSaveGitSettings={handleSaveGitSettings}
      />

      {/* Export & 1-Click Atomic Commit Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        gitSettings={gitSettings}
        searchQuery={query}
        sources={sources}
      />

      {/* Research Telemetry & Activity Backlog Terminal Drawer */}
      <ActivityLogDrawer
        logs={logs}
        onClearLogs={() => setLogs([])}
      />

      {/* Persistent Floating Mini-Dock when screening in background */}
      <AiScreenMiniDock
        isScreening={isScreening && !isAiProgressModalOpen}
        progress={aiProgress}
        onExpand={() => setIsAiProgressModalOpen(true)}
      />

    </div>
  );
}
