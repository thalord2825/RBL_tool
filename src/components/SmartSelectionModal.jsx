import React, { useState, useMemo } from 'react';
import { 
  X, 
  Sparkles, 
  Filter, 
  CheckSquare, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Check, 
  Play, 
  Layers, 
  FileText, 
  ShieldAlert, 
  Eye, 
  Sliders, 
  HelpCircle,
  XCircle,
  RefreshCw,
  Zap
} from 'lucide-react';
import { 
  getBuiltInPresets, 
  evaluateCompoundRule, 
  evaluateCondition 
} from '../services/ruleEvaluator';

const FIELD_OPTIONS = [
  { value: 'title', label: 'Paper Title' },
  { value: 'abstract', label: 'Abstract' },
  { value: 'authors', label: 'Authors' },
  { value: 'venue', label: 'Venue / Journal' },
  { value: 'year', label: 'Publication Year' },
  { value: 'source', label: 'Academic Source' },
  { value: 'doi', label: 'DOI' },
  { value: 'ai_decision', label: 'AI Verdict' },
  { value: 'ai_confidence', label: 'AI Confidence Score' },
  { value: 'ai_rationale', label: 'AI Scientific Rationale' },
  { value: 'exclusion_reason', label: 'Exclusion Reason (EC)' },
  { value: 'sample_size_n', label: 'Sample Size (N)' },
  { value: 'empirical_results', label: 'Empirical Results' },
];

const OPERATOR_OPTIONS = [
  { value: 'is_empty', label: 'is empty / missing (N/A)' },
  { value: 'is_not_empty', label: 'is NOT empty' },
  { value: 'contains', label: 'contains (case-insensitive)' },
  { value: 'not_contains', label: 'does NOT contain' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'equals', label: 'equals exactly' },
  { value: 'regex', label: 'matches regex' },
  { value: 'lt', label: 'numeric < (less than)' },
  { value: 'gt', label: 'numeric > (greater than)' },
];

export default function SmartSelectionModal({
  isOpen,
  onClose,
  papers = [],
  ecList = [],
  currentSelectedIds = new Set(),
  onApplySelection,
  onBatchExclude
}) {
  const [matchMode, setMatchMode] = useState('AND'); // 'AND' | 'OR'
  const [conditions, setConditions] = useState([
    { field: 'abstract', operator: 'is_empty', value: '' }
  ]);
  const [activePresetId, setActivePresetId] = useState('missing_abstract');
  const [instantExcludeReason, setInstantExcludeReason] = useState(
    ecList[0] || 'EC1: Studies focusing solely on malware analysis, or pure URL identification via hash algorithms without semantic text analysis.'
  );
  const [showExcludeConfirm, setShowExcludeConfirm] = useState(false);

  const presets = useMemo(() => getBuiltInPresets(ecList), [ecList]);

  // Compute matching papers in real-time
  const matchedPapers = useMemo(() => {
    return papers.filter(p => evaluateCompoundRule(p, conditions, matchMode));
  }, [papers, conditions, matchMode]);

  const matchedIds = useMemo(() => new Set(matchedPapers.map(p => p.id)), [matchedPapers]);
  const previewRows = matchedPapers.slice(0, 6);

  if (!isOpen) return null;

  const handleAddCondition = () => {
    setConditions(prev => [
      ...prev,
      { field: 'abstract', operator: 'contains', value: '' }
    ]);
    setActivePresetId(null);
  };

  const handleRemoveCondition = (index) => {
    setConditions(prev => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [{ field: 'abstract', operator: 'is_empty', value: '' }];
    });
    setActivePresetId(null);
  };

  const handleConditionChange = (index, key, val) => {
    setConditions(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: val };
      return next;
    });
    setActivePresetId(null);
  };

  const handleLoadPreset = (preset) => {
    setActivePresetId(preset.id);
    if (preset.defaultEcReason) {
      setInstantExcludeReason(preset.defaultEcReason);
    }

    // Convert preset into editable conditions
    switch (preset.id) {
      case 'missing_abstract':
        setMatchMode('OR');
        setConditions([
          { field: 'abstract', operator: 'is_empty', value: '' },
          { field: 'abstract', operator: 'equals', value: 'N/A' },
          { field: 'abstract', operator: 'regex', value: '^.{0,25}$' }
        ]);
        break;

      case 'missing_doi':
        setMatchMode('AND');
        setConditions([
          { field: 'doi', operator: 'is_empty', value: '' },
          { field: 'url', operator: 'is_empty', value: '' }
        ]);
        break;

      case 'missing_year':
        setMatchMode('OR');
        setConditions([
          { field: 'year', operator: 'is_empty', value: '' },
          { field: 'year', operator: 'lt', value: '2020' }
        ]);
        break;

      case 'missing_venue':
        setMatchMode('OR');
        setConditions([
          { field: 'venue', operator: 'is_empty', value: '' },
          { field: 'venue', operator: 'equals', value: 'N/A' }
        ]);
        break;

      case 'violates_ec1':
        setMatchMode('OR');
        setConditions([
          { field: 'exclusion_reason', operator: 'contains', value: 'EC1' },
          { field: 'ai_rationale', operator: 'contains', value: 'EC1' },
          { field: 'abstract', operator: 'contains', value: 'malware' },
          { field: 'title', operator: 'contains', value: 'hash' }
        ]);
        break;

      case 'violates_ec2':
        setMatchMode('OR');
        setConditions([
          { field: 'exclusion_reason', operator: 'contains', value: 'EC2' },
          { field: 'ai_rationale', operator: 'contains', value: 'EC2' },
          { field: 'abstract', operator: 'contains', value: 'voice call' },
          { field: 'title', operator: 'contains', value: 'vishing' }
        ]);
        break;

      case 'violates_ec3':
        setMatchMode('OR');
        setConditions([
          { field: 'exclusion_reason', operator: 'contains', value: 'EC3' },
          { field: 'ai_rationale', operator: 'contains', value: 'EC3' },
          { field: 'ai_rationale', operator: 'contains', value: 'rule-based' }
        ]);
        break;

      case 'violates_ec4':
        setMatchMode('OR');
        setConditions([
          { field: 'exclusion_reason', operator: 'contains', value: 'EC4' },
          { field: 'ai_rationale', operator: 'contains', value: 'EC4' },
          { field: 'sample_size_n', operator: 'equals', value: 'N/A' }
        ]);
        break;

      case 'violates_ec5':
        setMatchMode('OR');
        setConditions([
          { field: 'exclusion_reason', operator: 'contains', value: 'EC5' },
          { field: 'ai_rationale', operator: 'contains', value: 'EC5' },
          { field: 'abstract', operator: 'contains', value: 'inaccessible' }
        ]);
        break;

      case 'ai_rejected':
        setMatchMode('AND');
        setConditions([
          { field: 'ai_decision', operator: 'equals', value: 'EXCLUDED' }
        ]);
        break;

      case 'ai_uncertain':
        setMatchMode('OR');
        setConditions([
          { field: 'ai_decision', operator: 'equals', value: 'UNSURE' },
          { field: 'ai_confidence', operator: 'lt', value: '0.75' }
        ]);
        break;

      case 'unscreened_pending':
        setMatchMode('AND');
        setConditions([
          { field: 'ai_decision', operator: 'is_empty', value: '' },
          { field: 'status', operator: 'equals', value: 'PENDING' }
        ]);
        break;

      default:
        setMatchMode('AND');
        setConditions([{ field: 'abstract', operator: 'is_empty', value: '' }]);
        break;
    }
  };

  // Actions
  const handleApplyReplace = () => {
    const label = activePresetId 
      ? presets.find(p => p.id === activePresetId)?.label || 'Custom Rule' 
      : 'Custom Compound Rule';
    onApplySelection(matchedIds, 'REPLACE', label);
    onClose();
  };

  const handleApplyAdd = () => {
    const next = new Set(currentSelectedIds);
    matchedIds.forEach(id => next.add(id));
    const label = `Added ${matchedIds.size} via rule`;
    onApplySelection(next, 'ADD', label);
    onClose();
  };

  const handleApplyRemove = () => {
    const next = new Set(currentSelectedIds);
    matchedIds.forEach(id => next.delete(id));
    onApplySelection(next, 'REMOVE', 'Removed matching papers');
    onClose();
  };

  const handleConfirmBatchExclude = () => {
    if (matchedPapers.length === 0) return;
    if (onBatchExclude) {
      onBatchExclude(Array.from(matchedIds), instantExcludeReason);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#F4F1EA] border-2 border-[#1A1917] max-w-4xl w-full shadow-[8px_8px_0px_0px_rgba(26,25,23,0.85)] overflow-hidden my-6 font-mono flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-[#1A1917] text-[#F4F1EA] px-6 py-3.5 border-b-2 border-[#1A1917] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Zap className="w-5 h-5 text-[#EAB308]" />
            <div>
              <div className="font-mono text-[10px] text-[#A09B8E] uppercase tracking-widest font-bold">
                Declarative Screening Assistant
              </div>
              <h2 className="font-serif text-lg font-bold text-white tracking-wide">
                Smart Bulk Selection & Rule Builder
              </h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-[#33312E] text-[#A09B8E] hover:text-white transition-colors"
            title="Close modal (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 bg-[#F4F1EA] text-xs">
          
          {/* SECTION 1: QUICK PRESET PALETTE (CATEGORIZED PILLS) */}
          <div className="bg-[#EFECE4] border border-[#DCD6C5] p-3.5 rounded space-y-2">
            <div className="font-bold text-[11px] text-[#1A1917] uppercase flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#D94E28]" />
                <span>Protocol & Data Quality Presets:</span>
              </span>
              <span className="text-[10px] text-[#7A766F] font-normal">
                Click any preset to load its logic below
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {presets.map(pr => {
                const isActive = activePresetId === pr.id;
                return (
                  <button
                    key={pr.id}
                    onClick={() => handleLoadPreset(pr)}
                    className={`px-2.5 py-1 text-[11px] font-mono font-bold rounded border transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-[#1A1917] text-[#F4F1EA] border-[#1A1917] shadow-xs'
                        : 'bg-white text-[#4A4843] border-[#C8C1AE] hover:border-[#1A1917] hover:bg-[#FAF8F5]'
                    }`}
                    title={pr.description}
                  >
                    <span>{pr.label}</span>
                    {isActive && <Check className="w-3 h-3 text-[#38BDF8]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: COMPOUND RULE BUILDER */}
          <div className="bg-white border border-[#DCD6C5] p-4 rounded space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[#E5E0D3] pb-2">
              <div className="flex items-center gap-3">
                <span className="font-bold text-xs text-[#1A1917] uppercase">Selection Rules:</span>
                
                {/* Match Mode Toggle */}
                <div className="flex items-center bg-[#EDE9DF] p-0.5 rounded border border-[#DCD6C5] text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => { setMatchMode('AND'); setActivePresetId(null); }}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      matchMode === 'AND'
                        ? 'bg-[#1A1917] text-white'
                        : 'text-[#7A766F] hover:text-[#1A1917]'
                    }`}
                  >
                    Match ALL (AND)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMatchMode('OR'); setActivePresetId(null); }}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      matchMode === 'OR'
                        ? 'bg-[#1A1917] text-white'
                        : 'text-[#7A766F] hover:text-[#1A1917]'
                    }`}
                  >
                    Match ANY (OR)
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddCondition}
                className="bg-[#EDE9DF] hover:bg-[#DCD6C5] text-[#1A1917] border border-[#C8C1AE] px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#D94E28]" />
                <span>Add Condition</span>
              </button>
            </div>

            {/* Condition Rows */}
            <div className="space-y-2">
              {conditions.map((cond, idx) => {
                const isUnary = cond.operator === 'is_empty' || cond.operator === 'is_not_empty';

                return (
                  <div 
                    key={idx} 
                    className="flex items-center gap-2 bg-[#F8F6F0] p-2 rounded border border-[#E5E0D3] text-xs font-mono flex-wrap sm:flex-nowrap"
                  >
                    {/* Index Label */}
                    <span className="text-[#7A766F] font-bold text-[10px] w-6 text-center shrink-0">
                      #{idx + 1}
                    </span>

                    {/* Target Field */}
                    <select
                      value={cond.field}
                      onChange={(e) => handleConditionChange(idx, 'field', e.target.value)}
                      className="bg-white border border-[#C8C1AE] px-2 py-1 text-xs text-[#1A1917] rounded focus:outline-none focus:border-[#D94E28] shrink-0 font-bold"
                    >
                      {FIELD_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    {/* Operator */}
                    <select
                      value={cond.operator}
                      onChange={(e) => handleConditionChange(idx, 'operator', e.target.value)}
                      className="bg-white border border-[#C8C1AE] px-2 py-1 text-xs text-[#1A1917] rounded focus:outline-none focus:border-[#D94E28] shrink-0 font-bold"
                    >
                      {OPERATOR_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    {/* Value Input (Hidden if unary operator) */}
                    {!isUnary && (
                      <input
                        type="text"
                        value={cond.value}
                        onChange={(e) => handleConditionChange(idx, 'value', e.target.value)}
                        placeholder="Search term or regex..."
                        className="flex-1 min-w-[140px] bg-white border border-[#C8C1AE] px-2.5 py-1 text-xs text-[#1A1917] rounded focus:outline-none focus:border-[#D94E28]"
                      />
                    )}

                    {/* Remove Condition */}
                    <button
                      type="button"
                      onClick={() => handleRemoveCondition(idx)}
                      className="p-1 text-[#7A766F] hover:text-[#C93B2B] hover:bg-[#FADBD8] rounded transition-colors shrink-0"
                      title="Remove this condition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: LIVE REAL-TIME TELEMETRY & MATCH PREVIEW */}
          <div className="bg-[#F8F6F0] border border-[#DCD6C5] p-3.5 rounded space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#1A1917] uppercase">Live Match Count:</span>
                <span className="bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] px-2.5 py-0.5 rounded font-bold text-xs">
                  {matchedPapers.length} of {papers.length} Papers ({papers.length > 0 ? ((matchedPapers.length / papers.length) * 100).toFixed(1) : 0}%)
                </span>
              </div>
              <span className="text-[10px] text-[#7A766F]">
                Showing first {previewRows.length} matches below
              </span>
            </div>

            {/* Preview Table */}
            {previewRows.length > 0 ? (
              <div className="overflow-x-auto border border-[#DCD6C5] rounded bg-white max-h-40">
                <table className="w-full text-left font-sans text-[11px] table-fixed">
                  <thead className="bg-[#EDE9DF] border-b border-[#DCD6C5] font-mono text-[10px] text-[#4A4843] uppercase sticky top-0">
                    <tr>
                      <th className="p-2 w-12 text-center">ID</th>
                      <th className="p-2 min-w-[220px]">Title</th>
                      <th className="p-2 w-28">Status</th>
                      <th className="p-2 w-28">AI Verdict</th>
                      <th className="p-2 min-w-[140px]">Abstract Preview</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E0D3]">
                    {previewRows.map((paper) => (
                      <tr key={paper.id} className="hover:bg-[#FAF8F5]">
                        <td className="p-2 font-mono text-center font-bold text-[#7A766F]">{paper.id}</td>
                        <td className="p-2 font-serif font-semibold text-[#1A1917] truncate" title={paper.title}>
                          {paper.title}
                        </td>
                        <td className="p-2 font-mono text-[10px]">
                          <span className={`px-1.5 py-0.5 rounded font-bold ${
                            paper.status === 'INCLUDED' 
                              ? 'bg-[#D4EBD9] text-[#2D7A53]' 
                              : paper.status === 'EXCLUDED' 
                              ? 'bg-[#FADBD8] text-[#C93B2B]' 
                              : 'bg-[#FEF3C7] text-[#B8860B]'
                          }`}>
                            {paper.status}
                          </span>
                        </td>
                        <td className="p-2 font-mono text-[10px]">
                          {paper.ai_decision ? (
                            <span className="font-bold text-[#4A4843]">{paper.ai_decision} ({Math.round((paper.ai_confidence || 0.85) * 100)}%)</span>
                          ) : (
                            <span className="text-[#A09B8E] italic">Unscreened</span>
                          )}
                        </td>
                        <td className="p-2 text-[#7A766F] truncate text-[10px]" title={paper.abstract || 'N/A'}>
                          {paper.abstract && paper.abstract !== 'N/A' ? paper.abstract : '<Missing / N/A>'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-center text-[#7A766F] font-mono text-xs bg-white rounded border border-[#E5E0D3]">
                No papers in the current corpus match the active rule conditions.
              </div>
            )}
          </div>

          {/* SECTION 4: INSTANT BATCH EXCLUDE DIRECTIVE COLLAPSIBLE */}
          {showExcludeConfirm && (
            <div className="bg-[#FDF2F2] border-2 border-[#F5B7B1] p-3.5 rounded space-y-2.5 animate-in slide-in-from-top duration-150">
              <div className="flex items-center justify-between text-xs font-bold text-[#C93B2B] uppercase">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Confirm Instant Batch Exclusion of {matchedPapers.length} Papers:</span>
                </span>
                <button onClick={() => setShowExcludeConfirm(false)} className="text-[#7A766F] hover:text-[#1A1917]">✕</button>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-[#4A4843] font-bold">Assign Exclusion Criterion (EC Reason):</label>
                <select
                  value={instantExcludeReason}
                  onChange={(e) => setInstantExcludeReason(e.target.value)}
                  className="w-full bg-white border border-[#C8C1AE] p-1.5 text-xs font-mono text-[#1A1917] focus:outline-none focus:border-[#C93B2B] rounded"
                >
                  {ecList.map((ec, i) => (
                    <option key={i} value={ec}>{ec}</option>
                  ))}
                  <option value="EC: Failed PICO Framework criteria">EC: Failed PICO Framework criteria</option>
                  <option value="EC5: Inaccessible record / Missing Abstract">EC5: Inaccessible record / Missing Abstract</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowExcludeConfirm(false)}
                  className="px-3 py-1 bg-[#EDE9DF] hover:bg-[#DCD6C5] text-[#1A1917] font-bold rounded"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBatchExclude}
                  className="px-4 py-1 bg-[#C93B2B] hover:bg-[#A93226] text-white font-bold rounded shadow-xs"
                >
                  Execute Batch Exclusion ({matchedPapers.length} Papers)
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="bg-[#EDE9DF] px-6 py-3.5 border-t border-[#DCD6C5] flex items-center justify-between shrink-0 flex-wrap gap-3">
          <div className="text-[11px] text-[#7A766F] font-mono">
            <span>Matches: <strong className="text-[#D94E28] font-bold">{matchedPapers.length} papers</strong></span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-[#EFECE4] hover:bg-[#DCD6C5] text-[#1A1917] font-bold rounded border border-[#C8C1AE] transition-colors"
            >
              Cancel
            </button>

            {/* Remove from selection if active */}
            {currentSelectedIds.size > 0 && (
              <button
                type="button"
                disabled={matchedPapers.length === 0}
                onClick={handleApplyRemove}
                className="px-3 py-1.5 bg-[#EDE9DF] hover:bg-[#DCD6C5] text-[#7A766F] hover:text-[#1A1917] font-bold rounded border border-[#C8C1AE] transition-colors disabled:opacity-50"
                title="Deselect any papers matching this rule"
              >
                Remove (-{matchedPapers.length})
              </button>
            )}

            {/* Add to current selection */}
            {currentSelectedIds.size > 0 && (
              <button
                type="button"
                disabled={matchedPapers.length === 0}
                onClick={handleApplyAdd}
                className="px-3.5 py-1.5 bg-[#E0F2FE] hover:bg-[#BAE6FD] text-[#0369A1] font-bold rounded border border-[#BAE6FD] transition-colors disabled:opacity-50"
                title="Add matching papers to existing selection"
              >
                + Add ({matchedPapers.length})
              </button>
            )}

            {/* Instant Batch Exclude Trigger */}
            <button
              type="button"
              disabled={matchedPapers.length === 0}
              onClick={() => setShowExcludeConfirm(true)}
              className="px-3.5 py-1.5 bg-[#FADBD8] hover:bg-[#F5B7B1] text-[#C93B2B] font-bold rounded border border-[#F5B7B1] transition-colors disabled:opacity-50 flex items-center gap-1.5"
              title="Directly exclude all matching papers with an EC reason"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Batch Exclude ({matchedPapers.length})</span>
            </button>

            {/* Select Matching Only (Default Primary) */}
            <button
              type="button"
              disabled={matchedPapers.length === 0}
              onClick={handleApplyReplace}
              className="bg-[#D94E28] hover:bg-[#C4411C] py-1.5 px-4 font-bold flex items-center gap-1.5 text-white rounded transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Select Matching ({matchedPapers.length})</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
