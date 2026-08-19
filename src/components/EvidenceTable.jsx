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
  Calendar
} from 'lucide-react';
import AiRationaleModal from './AiRationaleModal';

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

  const [selectedAbstractPaper, setSelectedAbstractPaper] = useState(null);
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

  // Comprehensive Multi-Dimensional Filter & Smart Sorting
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
  }, [papers, filterStage, searchTerm, selectedSource, authorFilter, yearFilter, sortBy]);

  const visibleIds = filteredPapers.map(p => p.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedPaperIds.has(id));
  const someVisibleSelected = visibleIds.some(id => selectedPaperIds.has(id));

  // Count active non-default filters
  const hasActiveFilters = selectedSource !== 'ALL' || authorFilter.trim() !== '' || yearFilter !== 'ALL' || searchTerm.trim() !== '' || sortBy !== 'UNSCREENED_FIRST';

  const handleResetFilters = () => {
    setSelectedSource('ALL');
    setAuthorFilter('');
    setYearFilter('ALL');
    setSearchTerm('');
    setSortBy('UNSCREENED_FIRST');
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

  // Escape key clears selection
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedPaperIds(new Set());
        setIsBatchExcluding(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    } else {
      visibleIds.forEach(id => next.add(id));
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
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedPaperIds);
    if (ids.length === 0) return;

    if (window.confirm(`Permanently delete ${ids.length} selected paper records from SQLite corpus?`)) {
      if (onBulkDeletePapers) {
        await onBulkDeletePapers(ids);
      }
      setSelectedPaperIds(new Set());
    }
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
        
        {/* MULTI-DIMENSIONAL TOOLBAR (SEARCH + SOURCE + SORT + ADVANCED) */}
        <div className="p-2.5 bg-[#EFECE4] border-b border-[#DCD6C5] space-y-2 shrink-0">
          
          <div className="flex items-center justify-between gap-3 flex-wrap">
            
            {/* Primary Search Input */}
            <div className="relative flex-1 min-w-[240px] max-w-md">
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
                    title="Select / Deselect all visible papers"
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

                return (
                  <tr 
                    key={paper.id} 
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

                    {/* Col 2: ID */}
                    <td className="py-3 px-3 font-mono text-[11px] text-[#7A766F] text-center font-bold">
                      {paper.id}
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

                          {/* Prominent Eye-Catching Read Abstract Button */}
                          {paper.abstract && paper.abstract !== 'N/A' && (
                            <button
                              onClick={() => setSelectedAbstractPaper(paper)}
                              className="bg-[#EBF8FF] hover:bg-[#BEE3F8] text-[#2B6CB0] hover:text-[#1A365D] border border-[#BEE3F8] hover:border-[#90CDF4] px-2 py-0.5 rounded font-mono text-[10px] font-bold inline-flex items-center gap-1.5 transition-all shadow-2xs group ml-1 cursor-pointer"
                              title="Click to open full paper abstract"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#3182CE] group-hover:scale-110 transition-transform" />
                              <span>Read Abstract</span>
                            </button>
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
                        onClick={() => onDeletePaper(paper.id)}
                        className="p-1 hover:bg-[#FADBD8] text-[#7A766F] hover:text-[#C93B2B] transition-colors border border-transparent hover:border-[#F5B7B1] rounded"
                        title="Delete paper record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
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

      {/* FLOATING BATCH COMMAND DOCK (STICKY ACTION BAR) */}
      {selectedPaperIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#1A1917] text-[#F4F1EA] border-2 border-[#D94E28] shadow-[0_12px_40px_rgba(0,0,0,0.6)] px-5 py-3 flex items-center gap-4 font-mono text-xs max-w-4xl w-auto select-none animate-in slide-in-from-bottom duration-200">
          
          {/* Summary Badge & Deselect */}
          <div className="flex items-center gap-2 pr-3 border-r border-[#4A4843]">
            <span className="bg-[#D94E28] text-white px-2.5 py-1 font-bold text-xs uppercase tracking-wider">
              {selectedPaperIds.size} Selected
            </span>
            <button
              onClick={() => setSelectedPaperIds(new Set())}
              className="text-[#A09B8E] hover:text-white text-[11px] underline flex items-center gap-1 transition-colors"
              title="Clear selection (Esc)"
            >
              <X className="w-3.5 h-3.5" />
              <span>Deselect (Esc)</span>
            </button>
          </div>

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

      {/* Dedicated AI Decision & Scientific Rationale Audit Modal */}
      <AiRationaleModal
        isOpen={!!selectedRationalePaper}
        paper={selectedRationalePaper}
        onClose={() => setSelectedRationalePaper(null)}
        onUpdateStatus={onUpdateStatus}
      />

      {/* Abstract Viewer Modal */}
      {selectedAbstractPaper && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none animate-in fade-in duration-200">
          <div className="bg-[#F4F1EA] border-2 border-[#1A1917] max-w-2xl w-full shadow-[8px_8px_0px_0px_rgba(26,25,23,0.85)] overflow-hidden font-mono flex flex-col max-h-[85vh]">
            <div className="bg-[#1A1917] text-[#F4F1EA] px-6 py-3 border-b-2 border-[#1A1917] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#38BDF8]" />
                <h3 className="font-serif text-base font-bold text-white tracking-wide">
                  [{selectedAbstractPaper.id}] Publication Abstract
                </h3>
              </div>
              <button 
                onClick={() => setSelectedAbstractPaper(null)}
                className="p-1 hover:bg-[#33312E] text-[#A09B8E] hover:text-white transition-colors"
                title="Close modal (Esc)"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1 bg-[#F4F1EA]">
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

              <div className="space-y-1.5">
                <div className="text-[10px] text-[#7A766F] uppercase font-bold flex items-center gap-1 font-mono">
                  <span>Abstract Text:</span>
                </div>
                <div className="bg-[#F8F6F0] p-4 border border-[#DCD6C5] border-l-4 border-l-[#D94E28] rounded font-sans text-xs text-[#2C2B29] leading-relaxed shadow-inner">
                  {selectedAbstractPaper.abstract}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
