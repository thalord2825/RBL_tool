import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink, 
  Search, 
  Edit3, 
  Trash2, 
  Eye, 
  AlertTriangle, 
  Sparkles, 
  HelpCircle, 
  GitMerge,
  Info,
  CheckSquare,
  Square,
  MinusSquare,
  X,
  Check,
  Layers,
  Users,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Filter,
  ArrowUpDown,
  RotateCcw,
  SlidersHorizontal,
  Calendar,
  Zap,
  Sliders,
  ShieldAlert,
  ArrowRightLeft,
  Pin,
  PinOff,
  Globe,
  Loader2,
  Save,
  RefreshCw
} from 'lucide-react';
import AiRationaleModal from './AiRationaleModal';
import SmartSelectionModal from './SmartSelectionModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import { getBuiltInPresets, filterPapersByRule } from '../services/ruleEvaluator';
import apiClient from '../services/apiClient';

export default function EvidenceTable({ 
  papers, 
  onUpdateStatus, 
  onRequestExclude, 
  onOpenExtraction, 
  onDeletePaper,
  onOpenDuplicateCompare,
  onBulkUpdateStatus,
  onBulkDeletePapers,
  onBulkAiScreen,
  onUpdatePaper,
  onBulkPapersUpdate,
  ecList = [],
  selectedPaperIds: externalSelectedIds,
  onSelectionChange,
  onFilterChange
}) {
  const [filterStage, setFilterStage] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSource, setSelectedSource] = useState('ALL');
  const [authorFilter, setAuthorFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('UNSCREENED_FIRST'); // 'UNSCREENED_FIRST' | 'NEWEST_HARVEST' | 'YEAR_DESC' | 'YEAR_ASC' | 'TITLE_AZ' | 'CITATIONS_DESC'
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Pin Selected Papers to Top State
  const [pinSelected, setPinSelected] = useState(true);

  // Delete Modal State
  const [deletingPaper, setDeletingPaper] = useState(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  // Smart Selection & Rule Engine State
  const [isSmartSelectOpen, setIsSmartSelectOpen] = useState(false);
  const [isSmartModalOpen, setIsSmartModalOpen] = useState(false);
  const [activeRuleLabel, setActiveRuleLabel] = useState(null);
  const [activeRuleDefaultEc, setActiveRuleDefaultEc] = useState(null);

  // Abstract Viewer & Inline Editor State
  const [selectedAbstractPaper, setSelectedAbstractPaper] = useState(null);
  const [isEditingAbstract, setIsEditingAbstract] = useState(false);
  const [editableAbstractText, setEditableAbstractText] = useState('');
  const [isSavingAbstract, setIsSavingAbstract] = useState(false);
  const [fetchingAbstractId, setFetchingAbstractId] = useState(null);
  const [isBulkFetchingAbstracts, setIsBulkFetchingAbstracts] = useState(false);

  const [selectedRationalePaper, setSelectedRationalePaper] = useState(null);
  const [copiedDoiId, setCopiedDoiId] = useState(null);

  // Multi-Select State (External or Internal)
  const [internalSelectedIds, setInternalSelectedIds] = useState(new Set());
  const selectedPaperIds = externalSelectedIds !== undefined ? externalSelectedIds : internalSelectedIds;

  const setSelectedPaperIds = (newValOrFn) => {
    const nextVal = typeof newValOrFn === 'function' ? newValOrFn(selectedPaperIds) : newValOrFn;
    if (onSelectionChange) {
      onSelectionChange(nextVal);
    }
    setInternalSelectedIds(nextVal);
  };

  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);
  const [isBatchExcluding, setIsBatchExcluding] = useState(false);
  const [batchEcReason, setBatchEcReason] = useState(ecList[0] || 'EC1: Studies focusing solely on malware analysis, or pure URL identification via hash algorithms without semantic text analysis.');

  const masterCheckboxRef = useRef(null);
  const smartSelectDropdownRef = useRef(null);

  const presets = useMemo(() => getBuiltInPresets(ecList), [ecList]);

  // Available unique Sources and Years computed from corpus
  const availableSources = useMemo(() => {
    const set = new Set();
    papers.forEach(p => {
      if (p && p.source) set.add(p.source);
    });
    return Array.from(set).sort();
  }, [papers]);

  const availableYears = useMemo(() => {
    const set = new Set();
    papers.forEach(p => {
      if (p && p.year) set.add(p.year);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [papers]);

  // Comprehensive Multi-Dimensional Filter & Smart Sorting with Pinned Selection Priority
  const filteredPapers = useMemo(() => {
    let result = papers.filter(paper => {
      if (!paper) return false;
      if (filterStage === 'INCLUDED' && paper.status !== 'INCLUDED') return false;
      if (filterStage === 'PENDING' && paper.status !== 'PENDING') return false;
      if (filterStage === 'EXCLUDED' && paper.status !== 'EXCLUDED') return false;
      if (filterStage === 'UNSURE' && paper.ai_decision !== 'UNSURE') return false;
      if (filterStage === 'DUPLICATES' && !paper.duplicate_flag) return false;

      // Source Filter
      if (selectedSource !== 'ALL' && paper.source !== selectedSource) return false;

      // Year Filter
      if (yearFilter !== 'ALL' && String(paper.year) !== String(yearFilter)) return false;

      // Author Filter
      if (authorFilter.trim()) {
        const aTerm = authorFilter.toLowerCase();
        if (!paper.authors?.toLowerCase().includes(aTerm)) return false;
      }

      // Search Query Filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        return (
          paper.title?.toLowerCase().includes(term) ||
          paper.authors?.toLowerCase().includes(term) ||
          paper.venue?.toLowerCase().includes(term) ||
          paper.abstract?.toLowerCase().includes(term) ||
          paper.ai_rationale?.toLowerCase().includes(term) ||
          paper.exclusion_reason?.toLowerCase().includes(term)
        );
      }

      return true;
    });

    // Sorting Engine
    result = [...result].sort((a, b) => {
      // Priority 1: Pinned Selected Rows to Top (if pinSelected is active)
      if (pinSelected && selectedPaperIds.size > 0) {
        const aSel = selectedPaperIds.has(a.id);
        const bSel = selectedPaperIds.has(b.id);
        if (aSel && !bSel) return -1;
        if (!aSel && bSel) return 1;
      }

      // Priority 2: Active Sort Mode
      if (sortBy === 'UNSCREENED_FIRST') {
        // Priority 0: PENDING and no ai_decision
        const aUnscreened = a.status === 'PENDING' && !a.ai_decision;
        const bUnscreened = b.status === 'PENDING' && !b.ai_decision;
        if (aUnscreened && !bUnscreened) return -1;
        if (!aUnscreened && bUnscreened) return 1;
        // Secondary: created_at descending or ID
        return (b.created_at || '').localeCompare(a.created_at || '') || b.id.localeCompare(a.id);
      }

      if (sortBy === 'NEWEST_HARVEST') {
        return (b.created_at || '').localeCompare(a.created_at || '') || b.id.localeCompare(a.id);
      }

      if (sortBy === 'YEAR_DESC') {
        return (b.year || 0) - (a.year || 0);
      }

      if (sortBy === 'YEAR_ASC') {
        return (a.year || 0) - (b.year || 0);
      }

      if (sortBy === 'TITLE_AZ') {
        return (a.title || '').localeCompare(b.title || '');
      }

      if (sortBy === 'CITATIONS_DESC') {
        return (b.citations_count || 0) - (a.citations_count || 0);
      }

      return 0;
    });

    return result;
  }, [papers, filterStage, searchTerm, selectedSource, authorFilter, yearFilter, sortBy, pinSelected, selectedPaperIds]);

  const visibleIds = filteredPapers.map(p => p.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedPaperIds.has(id));
  const someVisibleSelected = visibleIds.some(id => selectedPaperIds.has(id));

  // Determine last index of pinned selected items in the list to render divider
  const lastPinnedIndex = useMemo(() => {
    if (!pinSelected || selectedPaperIds.size === 0) return -1;
    let idx = -1;
    for (let i = 0; i < filteredPapers.length; i++) {
      if (selectedPaperIds.has(filteredPapers[i].id)) {
        idx = i;
      } else {
        break; // since sorted with selected first
      }
    }
    return idx;
  }, [filteredPapers, selectedPaperIds, pinSelected]);

  // Count missing abstracts in current selection for bulk action
  const selectedMissingAbstractCount = useMemo(() => {
    if (selectedPaperIds.size === 0) return 0;
    return Array.from(selectedPaperIds).filter(id => {
      const p = papers.find(x => x.id === id);
      return !p?.abstract || p.abstract === 'N/A' || p.abstract.trim().length < 25;
    }).length;
  }, [selectedPaperIds, papers]);

  // Count active non-default filters
  const hasActiveFilters = selectedSource !== 'ALL' || authorFilter.trim() !== '' || yearFilter !== 'ALL' || searchTerm.trim() !== '' || sortBy !== 'UNSCREENED_FIRST';

  const handleResetFilters = () => {
    setSelectedSource('ALL');
    setAuthorFilter('');
    setYearFilter('ALL');
    setSearchTerm('');
    setSortBy('UNSCREENED_FIRST');
  };

  // Smart Select Preset Handler
  const handleSelectPreset = (preset) => {
    const matched = filterPapersByRule(papers, preset.id, ecList);
    setSelectedPaperIds(new Set(matched));
    setActiveRuleLabel(preset.label);
    setActiveRuleDefaultEc(preset.defaultEcReason || null);
    if (preset.defaultEcReason) {
      setBatchEcReason(preset.defaultEcReason);
    }
    setIsSmartSelectOpen(false);
  };

  // Invert current selection
  const handleInvertSelection = () => {
    const next = new Set();
    visibleIds.forEach(id => {
      if (!selectedPaperIds.has(id)) {
        next.add(id);
      }
    });
    setSelectedPaperIds(next);
    setActiveRuleLabel('Inverted Selection');
  };

  // Smart Modal Selection Callback
  const handleSmartModalApply = (matchedIdsSet, mode, label) => {
    setSelectedPaperIds(matchedIdsSet);
    setActiveRuleLabel(label);
  };

  // Smart Modal Batch Exclude Callback
  const handleSmartModalBatchExclude = async (matchedIdsArray, ecReason) => {
    if (onBulkUpdateStatus && matchedIdsArray.length > 0) {
      await onBulkUpdateStatus(matchedIdsArray, {
        status: 'EXCLUDED',
        exclusion_reason: ecReason
      });
    }
    setSelectedPaperIds(new Set());
    setActiveRuleLabel(null);
  };

  // Single Abstract Fetch Handler
  const handleFetchSingleAbstract = async (paper) => {
    setFetchingAbstractId(paper.id);
    try {
      const res = await apiClient.fetchPaperAbstract(paper.id);
      if (res.status === 'success' || res.status === 'already_present') {
        if (onUpdatePaper && res.paper) {
          onUpdatePaper(res.paper);
        }
        if (selectedAbstractPaper && selectedAbstractPaper.id === paper.id) {
          setSelectedAbstractPaper(res.paper || { ...selectedAbstractPaper, abstract: res.abstract });
          setEditableAbstractText(res.abstract);
        }
      } else {
        alert(`Could not resolve abstract automatically for [${paper.id}]. You can manually paste it.`);
        // Open manual edit modal
        setSelectedAbstractPaper(paper);
        setEditableAbstractText(paper.abstract && paper.abstract !== 'N/A' ? paper.abstract : '');
        setIsEditingAbstract(true);
      }
    } catch (err) {
      alert(`Error fetching abstract: ${err.message}`);
    } finally {
      setFetchingAbstractId(null);
    }
  };

  // Bulk Abstract Auto-Recovery Handler
  const handleBulkFetchAbstracts = async () => {
    const missingIds = Array.from(selectedPaperIds).filter(id => {
      const p = papers.find(x => x.id === id);
      return !p?.abstract || p.abstract === 'N/A' || p.abstract.trim().length < 25;
    });

    if (missingIds.length === 0) return;

    setIsBulkFetchingAbstracts(true);
    try {
      const res = await apiClient.bulkFetchAbstracts({ paperIds: missingIds });
      if (res.papers && onBulkPapersUpdate) {
        onBulkPapersUpdate(res.papers);
      }
      alert(`Auto-Recovery Complete: Resolved ${res.resolved_count} of ${res.total_requested} abstracts from DOI landing pages & academic APIs!`);
    } catch (err) {
      alert(`Bulk abstract recovery failed: ${err.message}`);
    } finally {
      setIsBulkFetchingAbstracts(false);
    }
  };

  // Open Abstract Viewer Modal
  const handleOpenAbstractViewer = (paper, editMode = false) => {
    setSelectedAbstractPaper(paper);
    setEditableAbstractText(paper.abstract && paper.abstract !== 'N/A' ? paper.abstract : '');
    setIsEditingAbstract(editMode);
  };

  // Save Manual Abstract
  const handleSaveManualAbstract = async () => {
    if (!selectedAbstractPaper) return;
    setIsSavingAbstract(true);
    try {
      const res = await apiClient.updatePaperAbstract(selectedAbstractPaper.id, editableAbstractText);
      if (onUpdatePaper && res.paper) {
        onUpdatePaper(res.paper);
      }
      setSelectedAbstractPaper(res.paper);
      setIsEditingAbstract(false);
    } catch (err) {
      alert(`Failed to save abstract: ${err.message}`);
    } finally {
      setIsSavingAbstract(false);
    }
  };

  // Notify parent of filter change
  useEffect(() => {
    if (onFilterChange) {
      onFilterChange({
        filterStage,
        filteredPaperIds: visibleIds,
        filteredCount: visibleIds.length
      });
    }
  }, [filterStage, visibleIds.length, onFilterChange]);

  // Sync indeterminate state for master checkbox
  useEffect(() => {
    if (masterCheckboxRef.current) {
      masterCheckboxRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [someVisibleSelected, allVisibleSelected]);

  // Global Keyboard Shortcuts (Shift+S, Ctrl+A, Esc)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Shift+S: Open Smart Selection Modal
      if (e.shiftKey && (e.key === 'S' || e.key === 's') && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        setIsSmartModalOpen(true);
        setIsSmartSelectOpen(false);
      }

      // Ctrl+A / Cmd+A inside evidence table
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A') && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        setSelectedPaperIds(new Set(visibleIds));
        setActiveRuleLabel('All Visible Papers');
      }

      // Escape: Clear selection and close dropdowns
      if (e.key === 'Escape') {
        setSelectedPaperIds(new Set());
        setIsBatchExcluding(false);
        setIsSmartSelectOpen(false);
        setActiveRuleLabel(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visibleIds]);

  // Close smart select dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (smartSelectDropdownRef.current && !smartSelectDropdownRef.current.contains(e.target)) {
        setIsSmartSelectOpen(false);
      }
    };
    if (isSmartSelectOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSmartSelectOpen]);

  // Update default batch EC when ecList prop changes
  useEffect(() => {
    if (ecList && ecList.length > 0) {
      setBatchEcReason(ecList[0]);
    }
  }, [ecList]);

  // Master Checkbox Toggle
  const handleToggleSelectAll = () => {
    const next = new Set(selectedPaperIds);
    if (allVisibleSelected) {
      visibleIds.forEach(id => next.delete(id));
      setActiveRuleLabel(null);
    } else {
      visibleIds.forEach(id => next.add(id));
      setActiveRuleLabel('All Visible Papers');
    }
    setSelectedPaperIds(next);
  };

  // Row Checkbox Toggle with Shift+Click Range Selection
  const handleRowCheck = (paperId, index, e) => {
    e.stopPropagation();
    const next = new Set(selectedPaperIds);

    if (e.shiftKey && lastSelectedIndex !== null && lastSelectedIndex !== index) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeIds = filteredPapers.slice(start, end + 1).map(p => p.id);
      rangeIds.forEach(id => next.add(id));
    } else {
      if (next.has(paperId)) {
        next.delete(paperId);
      } else {
        next.add(paperId);
      }
    }

    setSelectedPaperIds(next);
    setLastSelectedIndex(index);
  };

  // Copy DOI to clipboard
  const handleCopyDoi = (paperId, doi) => {
    if (!doi) return;
    const cleanDoi = doi.startsWith('http') ? doi : `https://doi.org/${doi}`;
    navigator.clipboard.writeText(cleanDoi);
    setCopiedDoiId(paperId);
    setTimeout(() => setCopiedDoiId(null), 2000);
  };

  // Source Badge Color Accent Mapping
  const getSourceBadgeStyle = (source) => {
    switch (source?.toLowerCase()) {
      case 'arxiv':
        return 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]';
      case 'openalex':
        return 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]';
      case 'semantic scholar':
        return 'bg-[#F3E8FF] text-[#6B21A8] border-[#E9D8FD]';
      case 'crossref':
        return 'bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]';
      case 'google scholar':
        return 'bg-[#FFE4E6] text-[#9F1239] border-[#FECDD3]';
      case 'csv import':
        return 'bg-[#E2E8F0] text-[#334155] border-[#CBD5E1]';
      default:
        return 'bg-[#EDE9DF] text-[#1A1917] border-[#DCD6C5]';
    }
  };

  // Bulk Actions
  const handleBulkSetStatus = async (status, exclusionReason = null) => {
    const ids = Array.from(selectedPaperIds);
    if (ids.length === 0) return;

    if (onBulkUpdateStatus) {
      await onBulkUpdateStatus(ids, {
        status,
        ...(exclusionReason ? { exclusion_reason: exclusionReason } : {})
      });
    }
    setSelectedPaperIds(new Set());
    setIsBatchExcluding(false);
    setActiveRuleLabel(null);
  };

  const handleSingleDeleteClick = (paper) => {
    setDeletingPaper(paper);
  };

  const handleSingleDeleteConfirm = async (paperId) => {
    if (onDeletePaper) {
      await onDeletePaper(paperId);
    }
    setDeletingPaper(null);
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedPaperIds);
    if (ids.length === 0) return;
    setIsBulkDeleteOpen(true);
  };

  const handleBulkDeleteConfirm = async (ids) => {
    if (onBulkDeletePapers) {
      await onBulkDeletePapers(ids);
    }
    setSelectedPaperIds(new Set());
    setActiveRuleLabel(null);
    setIsBulkDeleteOpen(false);
  };

  const handleBulkScreen = () => {
    const ids = Array.from(selectedPaperIds);
    if (ids.length === 0) return;
    if (onBulkAiScreen) {
      onBulkAiScreen(ids);
    }
  };

  const includedCount = papers.filter(p => p.status === 'INCLUDED').length;
  const pendingCount = papers.filter(p => p.status === 'PENDING').length;
  const excludedCount = papers.filter(p => p.status === 'EXCLUDED').length;
  const unsureCount = papers.filter(p => p.ai_decision === 'UNSURE').length;
  const duplicatesCount = papers.filter(p => p.duplicate_flag).length;

  const handleStatusChange = (paper, newStatus) => {
    if (newStatus === 'EXCLUDED') {
      onRequestExclude(paper);
    } else {
      onUpdateStatus(paper.id, {
        status: newStatus,
        exclusion_reason: null
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#F4F1EA]">
      
      {/* FILTER TABS */}
      <div className="bg-[#EAE6DC] border-b border-[#DCD6C5] px-4 flex items-center gap-1 font-mono text-xs select-none shrink-0 overflow-x-auto">
        <button
          onClick={() => setFilterStage('ALL')}
          className={`px-3 py-2 font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            filterStage === 'ALL'
              ? 'border-[#D94E28] text-[#D94E28] bg-[#F4F1EA]'
              : 'border-transparent text-[#7A766F] hover:text-[#1A1917]'
          }`}
        >
          <span>ALL RECORDS</span>
          <span className="bg-[#DCD6C5] px-1.5 py-0.2 text-[10px] text-[#1A1917] font-semibold">{papers.length}</span>
        </button>

        <button
          onClick={() => setFilterStage('PENDING')}
          className={`px-3 py-2 font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            filterStage === 'PENDING'
              ? 'border-[#B8860B] text-[#B8860B] bg-[#F4F1EA]'
              : 'border-transparent text-[#7A766F] hover:text-[#1A1917]'
          }`}
        >
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>PENDING</span>
          </span>
          <span className="bg-[#FEF3C7] text-[#B8860B] px-1.5 py-0.2 text-[10px]">{pendingCount}</span>
        </button>

        <button
          onClick={() => setFilterStage('INCLUDED')}
          className={`px-3 py-2 font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            filterStage === 'INCLUDED'
              ? 'border-[#2D7A53] text-[#2D7A53] bg-[#F4F1EA]'
              : 'border-transparent text-[#7A766F] hover:text-[#1A1917]'
          }`}
        >
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>INCLUDED</span>
          </span>
          <span className="bg-[#D4EBD9] text-[#2D7A53] px-1.5 py-0.2 text-[10px]">{includedCount}</span>
        </button>

        <button
          onClick={() => setFilterStage('EXCLUDED')}
          className={`px-3 py-2 font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            filterStage === 'EXCLUDED'
              ? 'border-[#C93B2B] text-[#C93B2B] bg-[#F4F1EA]'
              : 'border-transparent text-[#7A766F] hover:text-[#1A1917]'
          }`}
        >
          <span className="flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            <span>EXCLUDED</span>
          </span>
          <span className="bg-[#FADBD8] text-[#C93B2B] px-1.5 py-0.2 text-[10px]">{excludedCount}</span>
        </button>

        <button
          onClick={() => setFilterStage('UNSURE')}
          className={`px-3 py-2 font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            filterStage === 'UNSURE'
              ? 'border-[#805AD5] text-[#805AD5] bg-[#F4F1EA]'
              : 'border-transparent text-[#7A766F] hover:text-[#1A1917]'
          }`}
        >
          <span className="flex items-center gap-1">
            <HelpCircle className="w-3 h-3" />
            <span>AI UNSURE</span>
          </span>
          <span className="bg-[#E9D8FD] text-[#805AD5] px-1.5 py-0.2 text-[10px]">{unsureCount}</span>
        </button>

        <button
          onClick={() => setFilterStage('DUPLICATES')}
          className={`px-3 py-2 font-bold transition-all border-b-2 flex items-center gap-1.5 ${
            filterStage === 'DUPLICATES'
              ? 'border-[#D97706] text-[#D97706] bg-[#F4F1EA]'
              : 'border-transparent text-[#7A766F] hover:text-[#1A1917]'
          }`}
        >
          <span className="flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            <span>DUPLICATES</span>
          </span>
          <span className="bg-[#FDE68A] text-[#92400E] px-1.5 py-0.2 text-[10px]">{duplicatesCount}</span>
        </button>
      </div>

      {/* MAIN SCREENING TABLE CONTAINER */}
      <div className="flex-1 bg-[#F4F1EA] overflow-y-auto flex flex-col relative">
        
        {/* MULTI-DIMENSIONAL TOOLBAR (SEARCH + SMART SELECT + PIN TOGGLE + SOURCE + SORT + ADVANCED) */}
        <div className="p-2.5 bg-[#EFECE4] border-b border-[#DCD6C5] space-y-2 shrink-0">
          
          <div className="flex items-center justify-between gap-3 flex-wrap">
            
            {/* Primary Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#7A766F]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search title, author, venue, abstract, AI rationale, EC..."
                className="w-full bg-[#F8F6F0] border border-[#C8C1AE] pl-8 pr-7 py-1.5 font-mono text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28] rounded"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2 text-[#A09B8E] hover:text-[#1A1917]"
                >
                  ✕
                </button>
              )}
            </div>

            {/* SMART BULK SELECT TRIGGER & DROPDOWN */}
            <div className="relative font-mono text-xs" ref={smartSelectDropdownRef}>
              <button
                type="button"
                onClick={() => setIsSmartSelectOpen(!isSmartSelectOpen)}
                className="bg-[#24221F] hover:bg-[#33312E] text-[#F4F1EA] border border-[#1A1917] px-2.5 py-1.5 rounded font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                title="Smart bulk selection by missing abstract, EC violation, or PICO mismatch"
              >
                <Zap className="w-3.5 h-3.5 text-[#EAB308]" />
                <span>Smart Select</span>
                <ChevronDown className="w-3 h-3 text-[#A09B8E]" />
              </button>

              {/* Popover Presets Dropdown */}
              {isSmartSelectOpen && (
                <div className="absolute left-0 mt-1 w-80 bg-[#F4F1EA] border-2 border-[#1A1917] shadow-[6px_6px_0px_0px_rgba(26,25,23,0.85)] z-50 p-2 space-y-2 text-xs font-mono animate-in fade-in duration-150 max-h-96 overflow-y-auto">
                  
                  {/* Category: Data Quality */}
                  <div>
                    <div className="text-[10px] text-[#7A766F] uppercase font-bold px-1.5 py-0.5 border-b border-[#DCD6C5]">
                      Data Quality & Incomplete Records
                    </div>
                    <div className="space-y-0.5 pt-1">
                      {presets.filter(p => p.category === 'Data Quality').map(preset => (
                        <button
                          key={preset.id}
                          onClick={() => handleSelectPreset(preset)}
                          className="w-full text-left px-2 py-1.5 hover:bg-[#EAE6DC] rounded flex items-center justify-between transition-colors group cursor-pointer"
                        >
                          <span className="font-semibold text-[#1A1917]">{preset.label}</span>
                          <span className="text-[10px] text-[#7A766F] group-hover:text-[#D94E28] font-bold">
                            {papers.filter(preset.predicate).length}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category: Exclusion Criteria */}
                  <div>
                    <div className="text-[10px] text-[#C93B2B] uppercase font-bold px-1.5 py-0.5 border-b border-[#DCD6C5]">
                      Exclusion Criteria (EC Violations)
                    </div>
                    <div className="space-y-0.5 pt-1">
                      {presets.filter(p => p.category === 'Exclusion Criteria (EC)').map(preset => (
                        <button
                          key={preset.id}
                          onClick={() => handleSelectPreset(preset)}
                          className="w-full text-left px-2 py-1.5 hover:bg-[#FADBD8]/40 rounded flex items-center justify-between transition-colors group cursor-pointer"
                        >
                          <span className="font-semibold text-[#1A1917]">{preset.label}</span>
                          <span className="text-[10px] text-[#C93B2B] font-bold">
                            {papers.filter(preset.predicate).length}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category: PICO & AI */}
                  <div>
                    <div className="text-[10px] text-[#805AD5] uppercase font-bold px-1.5 py-0.5 border-b border-[#DCD6C5]">
                      PICO & AI Screening
                    </div>
                    <div className="space-y-0.5 pt-1">
                      {presets.filter(p => p.category === 'PICO Framework' || p.category === 'AI Screening').map(preset => (
                        <button
                          key={preset.id}
                          onClick={() => handleSelectPreset(preset)}
                          className="w-full text-left px-2 py-1.5 hover:bg-[#E9D8FD]/40 rounded flex items-center justify-between transition-colors group cursor-pointer"
                        >
                          <span className="font-semibold text-[#1A1917]">{preset.label}</span>
                          <span className="text-[10px] text-[#805AD5] font-bold">
                            {papers.filter(preset.predicate).length}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Rule Builder Trigger */}
                  <div className="pt-1.5 border-t border-[#DCD6C5]">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSmartSelectOpen(false);
                        setIsSmartModalOpen(true);
                      }}
                      className="w-full text-left px-2.5 py-2 bg-[#EDE9DF] hover:bg-[#1A1917] hover:text-white rounded flex items-center justify-between font-bold text-[#1A1917] transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-[#D94E28]" />
                        <span>Custom Rule Builder...</span>
                      </span>
                      <span className="text-[10px] text-[#7A766F]">Shift+S</span>
                    </button>
                  </div>

                </div>
              )}
            </div>

            {/* PIN SELECTED TO TOP TOGGLE BUTTON */}
            <button
              type="button"
              onClick={() => setPinSelected(!pinSelected)}
              className={`px-2.5 py-1.5 font-mono text-xs font-bold rounded border flex items-center gap-1.5 transition-all cursor-pointer ${
                pinSelected && selectedPaperIds.size > 0
                  ? 'bg-[#D94E28] text-white border-[#A83416] shadow-xs'
                  : pinSelected
                  ? 'bg-[#EAE6DC] text-[#1A1917] border-[#C8C1AE]'
                  : 'bg-[#F8F6F0] text-[#7A766F] border-[#DCD6C5] hover:text-[#1A1917]'
              }`}
              title="Pin all selected/checked papers to the top of the table"
            >
              {pinSelected ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
              <span>Pin Selected {selectedPaperIds.size > 0 ? `(${selectedPaperIds.size})` : ''}</span>
            </button>

            {/* Source Filter Dropdown */}
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <span className="text-[#7A766F] text-[11px] font-bold">Source:</span>
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="bg-[#F8F6F0] border border-[#C8C1AE] px-2 py-1.5 text-xs text-[#1A1917] rounded focus:outline-none focus:border-[#D94E28] cursor-pointer"
              >
                <option value="ALL">All Sources ({papers.length})</option>
                {availableSources.map((src, i) => {
                  const count = papers.filter(p => p.source === src).length;
                  return (
                    <option key={i} value={src}>
                      {src} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Smart Sort Dropdown */}
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <span className="text-[#7A766F] text-[11px] font-bold flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-[#D94E28]" />
                <span>Sort:</span>
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-[#F8F6F0] border border-[#C8C1AE] px-2 py-1.5 text-xs text-[#1A1917] rounded focus:outline-none focus:border-[#D94E28] cursor-pointer font-bold"
              >
                <option value="UNSCREENED_FIRST">⚡ Unscreened First (Default)</option>
                <option value="NEWEST_HARVEST">🕒 Newest Harvested / Added</option>
                <option value="YEAR_DESC">📅 Year (Newest → Oldest)</option>
                <option value="YEAR_ASC">📅 Year (Oldest → Newest)</option>
                <option value="TITLE_AZ">🔤 Title (A → Z)</option>
                <option value="CITATIONS_DESC">📊 Citations (High → Low)</option>
              </select>
            </div>

            {/* Toggle Advanced Filters Button */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-2.5 py-1.5 font-mono text-xs font-bold rounded border flex items-center gap-1.5 transition-colors ${
                showAdvancedFilters || authorFilter || yearFilter !== 'ALL'
                  ? 'bg-[#1A1917] text-white border-[#1A1917]'
                  : 'bg-[#F8F6F0] text-[#55524B] border-[#C8C1AE] hover:bg-[#EDE9DF]'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>More Filters</span>
              {(authorFilter || yearFilter !== 'ALL') && (
                <span className="bg-[#D94E28] text-white text-[9px] px-1 rounded-full font-bold">!</span>
              )}
            </button>

            {/* Corpus Count Badge */}
            <div className="flex items-center gap-3 font-mono text-xs text-[#7A766F] ml-auto">
              {selectedPaperIds.size > 0 && (
                <span className="bg-[#FEF3C7] text-[#B8860B] border border-[#FDE68A] px-2 py-0.5 font-bold text-[11px] rounded">
                  {selectedPaperIds.size} Selected
                </span>
              )}
              <span>
                Showing <strong className="text-[#1A1917]">{filteredPapers.length}</strong> of {papers.length}
              </span>
            </div>

          </div>

          {/* ADVANCED FILTER DRAWER (AUTHOR & YEAR) */}
          {showAdvancedFilters && (
            <div className="bg-[#F8F6F0] p-2.5 border border-[#DCD6C5] rounded flex items-center gap-4 flex-wrap text-xs font-mono animate-in fade-in duration-150">
              
              {/* Author Quick Search */}
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Users className="w-3.5 h-3.5 text-[#7A766F] shrink-0" />
                <span className="font-bold text-[#1A1917] text-[11px] shrink-0">Filter Author:</span>
                <input
                  type="text"
                  value={authorFilter}
                  onChange={(e) => setAuthorFilter(e.target.value)}
                  placeholder="e.g. Alan Turing, Nguyen..."
                  className="w-full bg-white border border-[#C8C1AE] px-2 py-1 text-xs text-[#1A1917] rounded focus:outline-none focus:border-[#D94E28]"
                />
              </div>

              {/* Year Select Filter */}
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-[#7A766F] shrink-0" />
                <span className="font-bold text-[#1A1917] text-[11px] shrink-0">Year:</span>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="bg-white border border-[#C8C1AE] px-2 py-1 text-xs text-[#1A1917] rounded focus:outline-none focus:border-[#D94E28] cursor-pointer"
                >
                  <option value="ALL">All Years</option>
                  {availableYears.map((yr, i) => (
                    <option key={i} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

            </div>
          )}

          {/* ACTIVE FILTER PILLS STRIP */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap pt-0.5 font-mono text-[10px]">
              <span className="text-[#7A766F] font-bold">Active Filters:</span>

              {selectedSource !== 'ALL' && (
                <span className="bg-[#E0F2FE] text-[#0369A1] border border-[#BAE6FD] px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  <span>Source: {selectedSource}</span>
                  <button onClick={() => setSelectedSource('ALL')} className="hover:text-[#0C4A6E]">✕</button>
                </span>
              )}

              {authorFilter.trim() && (
                <span className="bg-[#F3E8FF] text-[#6B21A8] border border-[#E9D8FD] px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  <span>Author: "{authorFilter}"</span>
                  <button onClick={() => setAuthorFilter('')} className="hover:text-[#4C1D95]">✕</button>
                </span>
              )}

              {yearFilter !== 'ALL' && (
                <span className="bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  <span>Year: {yearFilter}</span>
                  <button onClick={() => setYearFilter('ALL')} className="hover:text-[#78350F]">✕</button>
                </span>
              )}

              {searchTerm.trim() && (
                <span className="bg-[#EDE9DF] text-[#1A1917] border border-[#DCD6C5] px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  <span>Query: "{searchTerm}"</span>
                  <button onClick={() => setSearchTerm('')} className="hover:text-[#D94E28]">✕</button>
                </span>
              )}

              {sortBy !== 'UNSCREENED_FIRST' && (
                <span className="bg-[#F4F1EA] text-[#4A4843] border border-[#DCD6C5] px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  <span>Sort: {sortBy}</span>
                  <button onClick={() => setSortBy('UNSCREENED_FIRST')} className="hover:text-[#D94E28]">✕</button>
                </span>
              )}

              <button
                onClick={handleResetFilters}
                className="text-[#D94E28] hover:underline font-bold flex items-center gap-0.5 ml-1"
                title="Reset all filters and sorting to default"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Clear All</span>
              </button>
            </div>
          )}

        </div>

        {/* Fixed Width Proportional Table Matrix with 4-Tier Metadata */}
        <div className="flex-1 overflow-x-auto pb-16">
          <table className="w-full text-left border-collapse font-sans text-xs table-fixed">
            <thead>
              <tr className="bg-[#EDE9DF] border-b border-[#DCD6C5] font-mono text-[10px] text-[#4A4843] uppercase tracking-wider select-none sticky top-0 z-10">
                
                {/* Master Select All Checkbox */}
                <th className="py-2.5 px-2 w-10 text-center bg-[#EDE9DF]">
                  <input
                    ref={masterCheckboxRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleToggleSelectAll}
                    className="accent-[#D94E28] cursor-pointer w-3.5 h-3.5"
                    title="Select / Deselect all visible papers (Ctrl+A)"
                  />
                </th>

                <th className="py-2.5 px-3 w-14 text-center">ID</th>
                <th className="py-2.5 px-3 w-48">Status & AI Verdict</th>
                <th className="py-2.5 px-4 min-w-[400px]">Paper Metadata (Title • Authors • Venue • Source • DOI)</th>
                <th className="py-2.5 px-3 w-44">Evidence Matrix (7 Cols)</th>
                <th className="py-2.5 px-3 w-14 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E0D3]">
              {filteredPapers.map((paper, index) => {
                const isSelected = selectedPaperIds.has(paper.id);
                const isIncluded = paper.status === 'INCLUDED';
                const isExcluded = paper.status === 'EXCLUDED';
                const isExtracted = isIncluded && paper.tool_model && paper.tool_model !== 'N/A';
                const confidence = Math.round((paper.ai_confidence || 0.85) * 100);
                const hasValidAbstract = paper.abstract && paper.abstract !== 'N/A' && paper.abstract.trim().length >= 25;
                const isFetchingThisAbstract = fetchingAbstractId === paper.id;
                const isDividerRow = pinSelected && lastPinnedIndex === index && index < filteredPapers.length - 1;

                return (
                  <React.Fragment key={paper.id}>
                    <tr 
                      className={`transition-colors align-top ${
                        isSelected
                          ? 'bg-[#FFF9EB] hover:bg-[#FFF3D6] border-l-4 border-[#D94E28]'
                          : paper.duplicate_flag
                          ? 'bg-[#FFFBEB] hover:bg-[#FEF3C7]' 
                          : isIncluded 
                          ? 'bg-[#F4F8F5] hover:bg-[#EAF3EC]' 
                          : isExcluded 
                          ? 'bg-[#FDF2F2] hover:bg-[#FAEAEA]' 
                          : 'bg-[#F4F1EA] hover:bg-[#EFECE4]'
                      }`}
                    >
                      {/* Col 1: Row Select Checkbox */}
                      <td className="py-3 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleRowCheck(paper.id, index, e)}
                          className="accent-[#D94E28] cursor-pointer w-3.5 h-3.5 mt-1"
                        />
                      </td>

                      {/* Col 2: ID & Pinned Badge */}
                      <td className="py-3 px-3 font-mono text-[11px] text-[#7A766F] text-center font-bold">
                        <div className="flex flex-col items-center gap-0.5">
                          <span>{paper.id}</span>
                          {isSelected && pinSelected && (
                            <span className="text-[9px] text-[#D94E28] font-bold flex items-center gap-0.5" title="Pinned to top">
                              <Pin className="w-2.5 h-2.5 fill-current" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Col 3: Status & Compact Clickable AI Judge Column */}
                      <td className="py-3 px-3">
                        <div className="space-y-1.5">
                          
                          {/* Status Dropdown */}
                          <select
                            value={paper.status}
                            onChange={(e) => handleStatusChange(paper, e.target.value)}
                            className={`font-mono text-[10px] font-bold py-1 px-2 border cursor-pointer uppercase transition-all focus:outline-none w-full ${
                              isIncluded
                                ? 'bg-[#D4EBD9] text-[#2D7A53] border-[#98D4A5]'
                                : isExcluded
                                ? 'bg-[#FADBD8] text-[#C93B2B] border-[#F5B7B1]'
                                : 'bg-[#FEF3C7] text-[#B8860B] border-[#FDE68A]'
                            }`}
                          >
                            <option value="INCLUDED">✓ INCLUDED</option>
                            <option value="PENDING">⏳ PENDING</option>
                            <option value="EXCLUDED">✕ EXCLUDED</option>
                          </select>

                          {/* Compact Clickable AI Decision Pill */}
                          {paper.ai_decision && (
                            <div 
                              onClick={() => setSelectedRationalePaper(paper)}
                              className="border border-[#C8C1AE] bg-[#FDFCF9] hover:bg-[#F4F1EA] hover:border-[#D94E28] p-1.5 font-mono text-[9px] shadow-2xs cursor-pointer transition-all group rounded"
                              title="Click to view full AI scientific rationale & criteria details"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className={`px-1.5 py-0.5 font-bold flex items-center gap-1 border rounded ${
                                  paper.ai_decision === 'INCLUDED'
                                    ? 'bg-[#D4EBD9] text-[#2D7A53] border-[#98D4A5]'
                                    : paper.ai_decision === 'EXCLUDED'
                                    ? 'bg-[#FADBD8] text-[#C93B2B] border-[#F5B7B1]'
                                    : 'bg-[#E9D8FD] text-[#805AD5] border-[#D6BCFA]'
                                }`}>
                                  <Sparkles className="w-2.5 h-2.5" />
                                  <span>{paper.ai_decision}</span>
                                </span>

                                <span className="text-[#7A766F] font-bold">
                                  {confidence}%
                                </span>
                              </div>

                              {paper.exclusion_reason && (
                                <div className="text-[#C93B2B] truncate pt-1 font-semibold border-t border-[#EDE9DF] mt-1">
                                  {paper.exclusion_reason}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Duplicate Alert Pill */}
                          {paper.duplicate_flag && (
                            <button
                              onClick={() => onOpenDuplicateCompare(paper, paper.duplicate_with_id)}
                              className="w-full bg-[#FEF3C7] border border-[#FDE68A] text-[#B8860B] p-1 font-mono text-[9px] font-bold flex items-center justify-between hover:bg-[#FDE68A] transition-colors rounded"
                            >
                              <span className="flex items-center gap-1 truncate">
                                <AlertTriangle className="w-3 h-3 shrink-0 text-[#D97706]" />
                                <span>Dup with [{paper.duplicate_with_id}]</span>
                              </span>
                              <GitMerge className="w-3 h-3 text-[#D97706] shrink-0" />
                            </button>
                          )}

                        </div>
                      </td>

                      {/* Col 4: 4-Tier High-Clarity Editorial Paper Metadata */}
                      <td className="py-3 px-4">
                        <div className="space-y-1.5">
                          
                          {/* Tier 1: Title & Canonical Link (Large Modern Academic Font) */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-sans text-[16.5px] font-bold text-[#111827] leading-snug tracking-tight">
                              {paper.url ? (
                                <a
                                  href={paper.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="hover:text-[#D94E28] hover:underline inline-flex items-start gap-1.5 group"
                                >
                                  <span>{paper.title}</span>
                                  <ExternalLink className="w-3.5 h-3.5 mt-1 text-[#7A766F] group-hover:text-[#D94E28] shrink-0" />
                                </a>
                              ) : (
                                <span>{paper.title}</span>
                              )}
                            </div>
                          </div>

                          {/* Tier 2: Authors Line (Subtle Secondary Attribution) */}
                          {paper.authors && (
                            <div className="font-sans text-[11.5px] text-[#666259] flex items-center gap-1.5">
                              <Users className="w-3 h-3 text-[#A09B8E] shrink-0" />
                              <span className="truncate max-w-xl" title={paper.authors}>
                                {paper.authors}
                              </span>
                            </div>
                          )}

                          {/* Tier 3: Metadata Chip Strip (High-Density Structured Pills) */}
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-[10px] font-mono">
                            
                            {/* Year Chip */}
                            {paper.year && (
                              <span className="bg-[#EDE9DF] text-[#1A1917] font-bold px-2 py-0.5 rounded border border-[#DCD6C5]" title="Publication Year">
                                {paper.year}
                              </span>
                            )}

                            {/* Venue Chip */}
                            {paper.venue && paper.venue !== 'N/A' && (
                              <span 
                                className="bg-[#F8F6F0] text-[#4A4843] font-serif italic px-2 py-0.5 rounded border border-[#E5E0D3] max-w-[220px] truncate"
                                title={`Publication Venue: ${paper.venue}`}
                              >
                                {paper.venue}
                              </span>
                            )}

                            {/* Source Chip with Color Accent */}
                            {paper.source && (
                              <span className={`px-2 py-0.5 rounded font-bold border ${getSourceBadgeStyle(paper.source)}`}>
                                {paper.source}
                              </span>
                            )}

                            {/* DOI Chip with Quick Copy */}
                            {paper.doi && paper.doi !== 'N/A' && (
                              <button
                                onClick={() => handleCopyDoi(paper.id, paper.doi)}
                                className="bg-[#F4F1EA] hover:bg-[#EDE9DF] text-[#55524C] hover:text-[#1A1917] border border-[#DCD6C5] px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors cursor-pointer"
                                title="Click to copy DOI link"
                              >
                                <span>DOI: {paper.doi.length > 22 ? `${paper.doi.slice(0, 20)}...` : paper.doi}</span>
                                {copiedDoiId === paper.id ? (
                                  <Check className="w-2.5 h-2.5 text-[#2D7A53]" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5 text-[#A09B8E]" />
                                )}
                              </button>
                            )}

                            {/* Citation Count */}
                            {paper.citations_count !== undefined && paper.citations_count > 0 && (
                              <span className="bg-[#F8F6F0] text-[#7A766F] border border-[#E5E0D3] px-1.5 py-0.5 rounded font-medium">
                                Cited: {paper.citations_count}
                              </span>
                            )}

                            {/* Matrix Extracted Indicator Chip */}
                            {isExtracted && (
                              <span className="bg-[#D4EBD9] text-[#2D7A53] border border-[#98D4A5] px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                                <FileText className="w-2.5 h-2.5" />
                                <span>Matrix ✓</span>
                              </span>
                            )}

                            {/* Tier 4: Abstract Action Buttons */}
                            {hasValidAbstract ? (
                              <button
                                onClick={() => handleOpenAbstractViewer(paper, false)}
                                className="bg-[#EBF8FF] hover:bg-[#BEE3F8] text-[#2B6CB0] hover:text-[#1A365D] border border-[#BEE3F8] hover:border-[#90CDF4] px-2 py-0.5 rounded font-mono text-[10px] font-bold inline-flex items-center gap-1.5 transition-all shadow-2xs group ml-1 cursor-pointer"
                                title="Click to read full abstract"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#3182CE] group-hover:scale-110 transition-transform" />
                                <span>Read Abstract</span>
                              </button>
                            ) : (
                              <div className="inline-flex items-center gap-1 ml-1">
                                {/* Auto-Fetch Abstract Button */}
                                <button
                                  disabled={isFetchingThisAbstract}
                                  onClick={() => handleFetchSingleAbstract(paper)}
                                  className="bg-[#FEF3C7] hover:bg-[#FDE68A] text-[#92400E] border border-[#FDE68A] px-2 py-0.5 rounded font-mono text-[10px] font-bold inline-flex items-center gap-1 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                                  title="Auto-fetch abstract from DOI landing page & academic APIs"
                                >
                                  {isFetchingThisAbstract ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-[#D94E28]" />
                                  ) : (
                                    <Globe className="w-3 h-3 text-[#D97706]" />
                                  )}
                                  <span>{isFetchingThisAbstract ? 'Fetching...' : 'Fetch Abstract'}</span>
                                </button>

                                {/* Paste / Edit Abstract Button */}
                                <button
                                  onClick={() => handleOpenAbstractViewer(paper, true)}
                                  className="bg-[#EDE9DF] hover:bg-[#DCD6C5] text-[#55524B] hover:text-[#1A1917] border border-[#C8C1AE] px-1.5 py-0.5 rounded font-mono text-[10px] font-bold inline-flex items-center gap-1 transition-all cursor-pointer"
                                  title="Manually paste or edit paper abstract"
                                >
                                  <Edit3 className="w-3 h-3 text-[#7A766F]" />
                                  <span>Paste</span>
                                </button>
                              </div>
                            )}

                          </div>

                        </div>
                      </td>

                      {/* Col 5: Evidence Extraction Status (7 Cols) */}
                      <td className="py-3 px-3 font-mono text-xs">
                        {isIncluded ? (
                          <div className="space-y-1">
                            <button
                              onClick={() => onOpenExtraction(paper)}
                              className={`px-2 py-1 border flex items-center gap-1 text-[10px] font-bold transition-all shadow-2xs rounded ${
                                isExtracted
                                  ? 'bg-[#D4EBD9] text-[#2D7A53] border-[#98D4A5] hover:bg-[#C2E4C9]'
                                  : 'bg-[#FEF3C7] text-[#B8860B] border-[#FDE68A] hover:bg-[#FDE68A]'
                              }`}
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>{isExtracted ? 'Edit 7-Col Matrix' : '+ Extract Evidence'}</span>
                            </button>

                            {isExtracted && (
                              <div className="text-[9px] text-[#4A4843] space-y-0.5 bg-[#FDFCF9] p-1.5 border border-[#DCD6C5] rounded">
                                <div className="truncate">Model: <strong>{paper.tool_model}</strong></div>
                                <div className="truncate">Results: <strong>{paper.empirical_results}</strong></div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#A09B8E] text-[10px] italic">—</span>
                        )}
                      </td>

                      {/* Col 6: Actions */}
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleSingleDeleteClick(paper)}
                          className="p-1 hover:bg-[#FADBD8] text-[#7A766F] hover:text-[#C93B2B] transition-colors border border-transparent hover:border-[#F5B7B1] rounded cursor-pointer"
                          title="Delete paper record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>

                    {/* Visual Section Divider between Pinned Selected papers and remaining corpus */}
                    {isDividerRow && (
                      <tr className="bg-[#EDE9DF] border-y-2 border-[#1A1917]/20 select-none">
                        <td colSpan={6} className="py-1.5 px-4 font-mono text-[10px] font-bold text-[#7A766F] text-center uppercase tracking-wider">
                          ─── End of Pinned Selection ({lastPinnedIndex + 1} Papers) • Remaining Records Below ───
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {filteredPapers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center font-mono text-xs text-[#7A766F]">
                    No papers in corpus matching current filters. Try resetting filters or click <strong>"Harvest Metadata"</strong> above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* FLOATING BATCH COMMAND DOCK (STICKY ACTION BAR WITH RULE CONTEXT & AUTO-RECOVERY) */}
      {selectedPaperIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#1A1917] text-[#F4F1EA] border-2 border-[#D94E28] shadow-[0_12px_40px_rgba(0,0,0,0.6)] px-5 py-3 flex items-center gap-3.5 font-mono text-xs max-w-5xl w-auto select-none animate-in slide-in-from-bottom duration-200 flex-wrap">
          
          {/* Summary Badge & Context Tag */}
          <div className="flex items-center gap-2 pr-3 border-r border-[#4A4843]">
            <span className="bg-[#D94E28] text-white px-2.5 py-1 font-bold text-xs uppercase tracking-wider rounded-xs">
              {selectedPaperIds.size} Selected
            </span>

            {activeRuleLabel && (
              <span className="bg-[#2D2A26] border border-[#55524B] text-[#FDE68A] text-[10px] px-2 py-0.5 font-bold truncate max-w-[200px]" title={activeRuleLabel}>
                {activeRuleLabel}
              </span>
            )}

            <button
              onClick={() => { setSelectedPaperIds(new Set()); setActiveRuleLabel(null); }}
              className="text-[#A09B8E] hover:text-white text-[11px] underline flex items-center gap-1 transition-colors ml-1"
              title="Clear selection (Esc)"
            >
              <X className="w-3.5 h-3.5" />
              <span>Deselect (Esc)</span>
            </button>
          </div>

          {/* Invert Selection Button */}
          <button
            onClick={handleInvertSelection}
            className="bg-[#2C2B29] hover:bg-[#383633] text-[#F4F1EA] border border-[#55524B] px-2.5 py-1.5 font-bold flex items-center gap-1.5 transition-colors"
            title="Invert current paper selection"
          >
            <ArrowRightLeft className="w-3 h-3 text-[#38BDF8]" />
            <span>Invert</span>
          </button>

          {/* Bulk Abstract Auto-Recovery Button (if any selected paper lacks abstract) */}
          {selectedMissingAbstractCount > 0 && (
            <button
              disabled={isBulkFetchingAbstracts}
              onClick={handleBulkFetchAbstracts}
              className="bg-[#D97706] hover:bg-[#B45309] text-white px-3 py-1.5 font-bold flex items-center gap-1.5 transition-colors border border-[#92400E] disabled:opacity-50 cursor-pointer"
              title={`Fetch missing abstracts for ${selectedMissingAbstractCount} selected papers`}
            >
              {isBulkFetchingAbstracts ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Globe className="w-3.5 h-3.5" />
              )}
              <span>Auto-Recover Abstracts ({selectedMissingAbstractCount})</span>
            </button>
          )}

          {/* Bulk Status Transitions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkSetStatus('INCLUDED')}
              className="bg-[#2D7A53] hover:bg-[#236142] text-white px-3 py-1.5 font-bold flex items-center gap-1.5 transition-colors border border-[#1E5237]"
              title="Move all selected papers to INCLUDED"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Set INCLUDED</span>
            </button>

            <button
              onClick={() => handleBulkSetStatus('PENDING')}
              className="bg-[#B8860B] hover:bg-[#996F08] text-white px-3 py-1.5 font-bold flex items-center gap-1.5 transition-colors border border-[#805D05]"
              title="Reset all selected papers to PENDING"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Set PENDING</span>
            </button>

            {/* Set Excluded with Rationale Picker */}
            <div className="relative">
              <button
                onClick={() => setIsBatchExcluding(!isBatchExcluding)}
                className="bg-[#C93B2B] hover:bg-[#A93226] text-white px-3 py-1.5 font-bold flex items-center gap-1.5 transition-colors border border-[#94271A]"
                title="Exclude all selected papers with rationale"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Set EXCLUDED...</span>
              </button>

              {/* Popover EC Selector */}
              {isBatchExcluding && (
                <div className="absolute bottom-full left-0 mb-2 w-96 bg-[#F4F1EA] text-[#1A1917] border-2 border-[#1A1917] shadow-[6px_6px_0px_0px_rgba(26,25,23,0.85)] p-3 space-y-2 z-50 animate-in fade-in duration-150">
                  <div className="font-bold text-[11px] uppercase text-[#C93B2B] flex items-center justify-between">
                    <span>Select Exclusion Criterion (EC):</span>
                    <button onClick={() => setIsBatchExcluding(false)} className="text-[#7A766F] hover:text-[#1A1917]">✕</button>
                  </div>
                  <select
                    value={batchEcReason}
                    onChange={(e) => setBatchEcReason(e.target.value)}
                    className="w-full bg-white border border-[#C8C1AE] p-1.5 text-[11px] font-mono text-[#1A1917] focus:outline-none focus:border-[#C93B2B]"
                  >
                    {ecList.map((ec, i) => (
                      <option key={i} value={ec}>{ec}</option>
                    ))}
                    <option value="EC: Failed PICO Framework criteria">EC: Failed PICO Framework criteria</option>
                    <option value="EC5: Inaccessible record / Missing Abstract">EC5: Inaccessible record / Missing Abstract</option>
                  </select>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setIsBatchExcluding(false)}
                      className="px-2 py-1 bg-[#DCD6C5] text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleBulkSetStatus('EXCLUDED', batchEcReason)}
                      className="px-3 py-1 bg-[#C93B2B] text-white text-xs font-bold"
                    >
                      Apply Exclusion ({selectedPaperIds.size})
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bulk AI Screening */}
          {onBulkAiScreen && (
            <button
              onClick={handleBulkScreen}
              className="bg-[#4F46E5] hover:bg-[#4338CA] text-white px-3 py-1.5 font-bold flex items-center gap-1.5 transition-colors border border-[#3730A3]"
              title="Run AI screening only on selected papers"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Screen ({selectedPaperIds.size})</span>
            </button>
          )}

          {/* Bulk Delete */}
          <div className="pl-3 border-l border-[#4A4843]">
            <button
              onClick={handleBulkDelete}
              className="bg-[#7F1D1D] hover:bg-[#991B1B] text-[#FCA5A5] hover:text-white px-3 py-1.5 font-bold flex items-center gap-1.5 transition-colors border border-[#991B1B]"
              title="Permanently delete all selected papers"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete ({selectedPaperIds.size})</span>
            </button>
          </div>

        </div>
      )}

      {/* Declarative Smart Bulk Selection & Rule Builder Modal */}
      <SmartSelectionModal
        isOpen={isSmartModalOpen}
        onClose={() => setIsSmartModalOpen(false)}
        papers={papers}
        ecList={ecList}
        currentSelectedIds={selectedPaperIds}
        onApplySelection={handleSmartModalApply}
        onBatchExclude={handleSmartModalBatchExclude}
      />

      {/* Dedicated AI Decision & Scientific Rationale Audit Modal */}
      <AiRationaleModal
        isOpen={!!selectedRationalePaper}
        paper={selectedRationalePaper}
        onClose={() => setSelectedRationalePaper(null)}
        onUpdateStatus={onUpdateStatus}
      />

      {/* Dual-Mode Abstract Viewer & Editor Modal */}
      {selectedAbstractPaper && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none animate-in fade-in duration-200">
          <div className="bg-[#F4F1EA] border-2 border-[#1A1917] max-w-3xl w-full shadow-[8px_8px_0px_0px_rgba(26,25,23,0.85)] overflow-hidden font-mono flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="bg-[#1A1917] text-[#F4F1EA] px-6 py-3.5 border-b-2 border-[#1A1917] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#38BDF8]" />
                <h3 className="font-serif text-base font-bold text-white tracking-wide">
                  [{selectedAbstractPaper.id}] Publication Abstract
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {/* Toggle Edit / View Mode */}
                <button
                  onClick={() => setIsEditingAbstract(!isEditingAbstract)}
                  className="px-2.5 py-1 text-[11px] font-bold bg-[#33312E] hover:bg-[#4A4843] text-white rounded border border-[#55524B] flex items-center gap-1 transition-colors"
                >
                  <Edit3 className="w-3 h-3 text-[#EAB308]" />
                  <span>{isEditingAbstract ? 'Reader View' : 'Edit Abstract'}</span>
                </button>

                <button 
                  onClick={() => { setSelectedAbstractPaper(null); setIsEditingAbstract(false); }}
                  className="p-1 hover:bg-[#33312E] text-[#A09B8E] hover:text-white transition-colors"
                  title="Close modal (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1 bg-[#F4F1EA]">
              
              {/* Paper Details Card */}
              <div className="bg-[#EFECE4] border border-[#DCD6C5] p-3.5 space-y-1.5 rounded">
                <div className="font-bold text-[15px] text-[#111827] font-sans leading-snug">
                  {selectedAbstractPaper.title}
                </div>
                <div className="text-[11px] text-[#666259] flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[#1A1917]">{selectedAbstractPaper.authors}</span>
                  <span>•</span>
                  <span className="bg-[#EDE9DF] px-1.5 py-0.2 rounded border border-[#DCD6C5] text-[#1A1917] font-bold font-mono text-[10px]">
                    {selectedAbstractPaper.year}
                  </span>
                  {selectedAbstractPaper.venue && selectedAbstractPaper.venue !== 'N/A' && (
                    <>
                      <span>•</span>
                      <span className="italic">{selectedAbstractPaper.venue}</span>
                    </>
                  )}
                  {selectedAbstractPaper.source && (
                    <>
                      <span>•</span>
                      <span className={`px-1.5 py-0.2 rounded font-bold border text-[9px] ${getSourceBadgeStyle(selectedAbstractPaper.source)}`}>
                        {selectedAbstractPaper.source}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* View / Edit Mode Content */}
              {isEditingAbstract ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="font-bold text-[#1A1917]">Edit or Paste Abstract Content:</span>
                    
                    {/* Auto Fetch Trigger inside Modal */}
                    <button
                      type="button"
                      disabled={fetchingAbstractId === selectedAbstractPaper.id}
                      onClick={() => handleFetchSingleAbstract(selectedAbstractPaper)}
                      className="text-[#D97706] hover:text-[#92400E] font-bold flex items-center gap-1 text-[11px] underline cursor-pointer disabled:opacity-50"
                    >
                      <Globe className="w-3 h-3" />
                      <span>Auto-Fetch from DOI ({selectedAbstractPaper.doi || 'Web'})</span>
                    </button>
                  </div>

                  <textarea
                    rows={8}
                    value={editableAbstractText}
                    onChange={(e) => setEditableAbstractText(e.target.value)}
                    placeholder="Paste full text abstract here..."
                    className="w-full bg-white border border-[#C8C1AE] p-3 text-xs font-sans text-[#1A1917] leading-relaxed rounded focus:outline-none focus:border-[#D94E28]"
                  />

                  <div className="flex items-center justify-between text-[10px] text-[#7A766F]">
                    <span>Character Count: <strong>{editableAbstractText.length}</strong> chars</span>
                    
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingAbstract(false)}
                        className="px-3 py-1 bg-[#EDE9DF] hover:bg-[#DCD6C5] text-[#1A1917] font-bold rounded"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isSavingAbstract || editableAbstractText.trim().length === 0}
                        onClick={handleSaveManualAbstract}
                        className="px-4 py-1 bg-[#2D7A53] hover:bg-[#236142] text-white font-bold rounded flex items-center gap-1 shadow-xs disabled:opacity-50 cursor-pointer"
                      >
                        {isSavingAbstract ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        <span>Save Changes</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-[#7A766F] uppercase font-bold flex items-center justify-between font-mono">
                    <span>Abstract Text:</span>
                    {selectedAbstractPaper.abstract && (
                      <span>{selectedAbstractPaper.abstract.length} characters</span>
                    )}
                  </div>
                  
                  {selectedAbstractPaper.abstract && selectedAbstractPaper.abstract !== 'N/A' ? (
                    <div className="bg-[#F8F6F0] p-4 border border-[#DCD6C5] border-l-4 border-l-[#D94E28] rounded font-sans text-xs text-[#2C2B29] leading-relaxed shadow-inner">
                      {selectedAbstractPaper.abstract}
                    </div>
                  ) : (
                    <div className="bg-[#FEF3C7]/40 border border-[#FDE68A] p-6 text-center space-y-3 rounded">
                      <AlertTriangle className="w-6 h-6 text-[#D97706] mx-auto" />
                      <div className="text-xs font-bold text-[#92400E]">No abstract recorded for this publication.</div>
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleFetchSingleAbstract(selectedAbstractPaper)}
                          className="px-3 py-1.5 bg-[#D97706] hover:bg-[#B45309] text-white font-bold text-xs rounded flex items-center gap-1.5 shadow-xs"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span>Fetch from DOI Landing Page</span>
                        </button>
                        <button
                          onClick={() => setIsEditingAbstract(true)}
                          className="px-3 py-1.5 bg-[#EDE9DF] hover:bg-[#DCD6C5] text-[#1A1917] font-bold text-xs rounded"
                        >
                          Paste Abstract Manually
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Modern Danger Confirmation Modal for Single Paper Deletion */}
      <DeleteConfirmModal
        isOpen={!!deletingPaper}
        onClose={() => setDeletingPaper(null)}
        onConfirm={handleSingleDeleteConfirm}
        paper={deletingPaper}
      />

      {/* Modern Danger Confirmation Modal for Bulk Paper Deletion */}
      <DeleteConfirmModal
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        paperIds={Array.from(selectedPaperIds)}
      />

    </div>
  );
}
