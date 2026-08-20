import React, { useState, useEffect } from 'react';
import { X, Save, FileText, ExternalLink, Sparkles, Loader2, RotateCcw, AlertCircle, CheckCircle2 } from 'lucide-react';
import apiClient, { getStoredGeminiApiKey } from '../services/apiClient';

export default function EvidenceExtractionModal({ isOpen, onClose, paper, onSaveExtraction, addToast }) {
  const [formData, setFormData] = useState({
    tool_model: 'N/A',
    dataset_name: 'N/A',
    sample_size_n: 'N/A',
    metrics_evaluated: 'N/A',
    empirical_results: 'N/A',
    code_url: 'N/A',
    limitations: 'N/A',
  });

  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractError, setExtractError] = useState(null);
  const [extractSuccess, setExtractSuccess] = useState(null);

  useEffect(() => {
    if (paper) {
      setFormData({
        tool_model: paper?.tool_model || 'N/A',
        dataset_name: paper?.dataset_name || 'N/A',
        sample_size_n: paper?.sample_size_n || 'N/A',
        metrics_evaluated: paper?.metrics_evaluated || 'N/A',
        empirical_results: paper?.empirical_results || 'N/A',
        code_url: paper?.code_url || 'N/A',
        limitations: paper?.limitations || 'N/A',
      });
      setExtractError(null);
      setExtractSuccess(null);
      setIsExtracting(false);
      setIsSaving(false);
    }
  }, [paper, isOpen]);

  if (!isOpen || !paper) return null;

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleResetToNA = () => {
    setFormData({
      tool_model: 'N/A',
      dataset_name: 'N/A',
      sample_size_n: 'N/A',
      metrics_evaluated: 'N/A',
      empirical_results: 'N/A',
      code_url: 'N/A',
      limitations: 'N/A',
    });
    setExtractSuccess('Reset all fields to "N/A" according to Zero Fabrication Policy.');
  };

  const handleAiExtract = async () => {
    if (!paper.abstract || paper.abstract.trim() === '' || paper.abstract === 'N/A') {
      setExtractError('Abstract is missing or "N/A". Please fetch or write the abstract before running AI extraction.');
      return;
    }

    setIsExtracting(true);
    setExtractError(null);
    setExtractSuccess(null);

    try {
      const apiKey = getStoredGeminiApiKey();
      const res = await apiClient.extractEvidence({
        paperId: paper.id,
        title: paper.title,
        abstract: paper.abstract,
        authors: paper.authors,
        year: paper.year,
        venue: paper.venue,
        apiKey,
      });

      if (res && res.status === 'success' && res.evidence) {
        setFormData({
          tool_model: res.evidence.tool_model || 'N/A',
          dataset_name: res.evidence.dataset_name || 'N/A',
          sample_size_n: res.evidence.sample_size_n || 'N/A',
          metrics_evaluated: res.evidence.metrics_evaluated || 'N/A',
          empirical_results: res.evidence.empirical_results || 'N/A',
          code_url: res.evidence.code_url || 'N/A',
          limitations: res.evidence.limitations || 'N/A',
        });
        const modelUsed = res.evidence.extracted_by_model || 'Gemini';
        setExtractSuccess(`Evidence successfully extracted via ${modelUsed}! Review numbers before saving.`);
        if (addToast) {
          addToast({
            type: 'success',
            title: 'Evidence Auto-Extracted',
            message: `Synthesized 7-column evidence matrix for [${paper.id || 'Paper'}] using ${modelUsed}.`
          });
        }
      } else {
        setExtractError('AI extraction returned empty response. You can continue with manual entry.');
      }
    } catch (err) {
      setExtractError(err.response?.data?.detail || err.message || 'AI evidence extraction failed.');
      if (addToast) {
        addToast({
          type: 'error',
          title: 'Extraction Error',
          message: err.response?.data?.detail || err.message || 'AI evidence extraction failed.'
        });
      }
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setExtractError(null);
    try {
      if (onSaveExtraction) {
        await onSaveExtraction(paper.id, formData);
      }
      onClose();
    } catch (err) {
      setExtractError(err.response?.data?.detail || err.message || 'Failed to save evidence entry.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none overflow-y-auto">
      <div className="bg-[#F4F1EA] border-2 border-[#1A1917] max-w-2xl w-full shadow-[8px_8px_0px_0px_rgba(26,25,23,0.8)] overflow-hidden my-8 animate-in fade-in duration-150">
        
        {/* Header */}
        <div className="bg-[#EDE9DF] px-6 py-3 border-b border-[#DCD6C5] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#2D7A53]">
            <FileText className="w-5 h-5" />
            <div>
              <div className="font-mono text-[10px] text-[#7A766F] uppercase tracking-widest font-bold">
                7-Column Evidence Matrix Form
              </div>
              <h2 className="font-serif text-xl font-bold text-[#1A1917]">
                Empirical Evidence Extraction
              </h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-[#DCD6C5] text-[#1A1917] transition-colors border border-[#C8C1AE]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper Metadata Banner */}
        <div className="p-4 bg-[#EFECE4] border-b border-[#DCD6C5] font-mono text-xs">
          <div className="font-bold text-[#1A1917] text-sm flex items-start justify-between gap-2">
            <span>{paper.title}</span>
            {paper.url && (
              <a 
                href={paper.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[#D94E28] hover:underline flex items-center gap-0.5 shrink-0"
              >
                <span>PDF / DOI</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <div className="text-[10px] text-[#7A766F] mt-1">
            {paper.authors} ({paper.year}) • <span className="italic">{paper.venue || 'Academic Publication'}</span>
          </div>
        </div>

        {/* AI Action & Zero Data Fabrication Warning Banner */}
        <div className="bg-[#FEF3C7] px-6 py-2.5 border-b border-[#FDE68A] flex items-center justify-between gap-3 font-mono">
          <div className="text-[10px] text-[#B8860B] font-bold uppercase tracking-tight">
            Zero Fabrication Policy: If paper omits any metric, leave field as "N/A".
          </div>

          <button
            type="button"
            onClick={handleAiExtract}
            disabled={isExtracting}
            className="bg-[#1A1917] hover:bg-[#2D7A53] text-[#F4F1EA] text-[11px] font-bold px-3 py-1 flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
            title="Auto-extract all 7 matrix fields from abstract with Gemini LLM"
          >
            {isExtracting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D94E28]" />
                <span>Extracting...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>AI Auto-Extract</span>
              </>
            )}
          </button>
        </div>

        {/* Status Alerts */}
        {extractSuccess && (
          <div className="px-6 py-2 bg-[#E6F4EA] text-[#1E7E34] text-xs font-mono border-b border-[#C3E6CB] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{extractSuccess}</span>
          </div>
        )}

        {extractError && (
          <div className="px-6 py-2 bg-[#FDE8E8] text-[#C93B2B] text-xs font-mono border-b border-[#F8B4B4] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{extractError}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 font-mono text-xs">
          
          {/* Column 2: Tool / LLM */}
          <div>
            <label className="block text-[11px] font-bold text-[#1A1917] mb-1 uppercase">
              2. Tool / LLM Models (Exact Named Architectures)
            </label>
            <input
              type="text"
              value={formData.tool_model}
              onChange={(e) => handleChange('tool_model', e.target.value)}
              className="w-full bg-[#F8F6F0] border border-[#C8C1AE] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28]"
              placeholder="e.g. PhoBERT-base, GPT-4o-mini (Few-Shot), BiGRU + WBCE"
            />
          </div>

          {/* Column 3: Dataset & Sample Size */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-[#1A1917] mb-1 uppercase">
                3. Dataset Name & Domain
              </label>
              <input
                type="text"
                value={formData.dataset_name}
                onChange={(e) => handleChange('dataset_name', e.target.value)}
                className="w-full bg-[#F8F6F0] border border-[#C8C1AE] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28]"
                placeholder="e.g. Vietnamese SMS/Zalo Spam Corpus"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#1A1917] mb-1 uppercase">
                Sample Size ($N$)
              </label>
              <input
                type="text"
                value={formData.sample_size_n}
                onChange={(e) => handleChange('sample_size_n', e.target.value)}
                className="w-full bg-[#F8F6F0] border border-[#C8C1AE] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28]"
                placeholder="e.g. N = 11,200 messages"
              />
            </div>
          </div>

          {/* Column 4 & 5: Metrics & Empirical Results */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-[#1A1917] mb-1 uppercase">
                4. Metrics Evaluated
              </label>
              <input
                type="text"
                value={formData.metrics_evaluated}
                onChange={(e) => handleChange('metrics_evaluated', e.target.value)}
                className="w-full bg-[#F8F6F0] border border-[#C8C1AE] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28]"
                placeholder="e.g. Macro-F1, Precision, Recall, Latency (ms)"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#1A1917] mb-1 uppercase">
                5. Empirical Results (Exact Numbers)
              </label>
              <input
                type="text"
                value={formData.empirical_results}
                onChange={(e) => handleChange('empirical_results', e.target.value)}
                className="w-full bg-[#F8F6F0] border border-[#C8C1AE] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28]"
                placeholder="e.g. PhoBERT: F1=94.1%, GPT-4: F1=91.5%"
              />
            </div>
          </div>

          {/* Column 6: Code Repository URL */}
          <div>
            <label className="block text-[11px] font-bold text-[#1A1917] mb-1 uppercase">
              6. Official Code Repository URL
            </label>
            <input
              type="text"
              value={formData.code_url}
              onChange={(e) => handleChange('code_url', e.target.value)}
              className="w-full bg-[#F8F6F0] border border-[#C8C1AE] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28]"
              placeholder="e.g. https://github.com/... or N/A"
            />
          </div>

          {/* Column 7: Limitations */}
          <div>
            <label className="block text-[11px] font-bold text-[#1A1917] mb-1 uppercase">
              7. Threats to Validity / Limitations
            </label>
            <textarea
              value={formData.limitations}
              onChange={(e) => handleChange('limitations', e.target.value)}
              rows={2}
              className="w-full bg-[#F8F6F0] border border-[#C8C1AE] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28]"
              placeholder="e.g. Evaluated only on clean text; does not benchmark teencode variants"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#DCD6C5]">
            <button
              type="button"
              onClick={handleResetToNA}
              className="text-[#7A766F] hover:text-[#C93B2B] flex items-center gap-1 text-[11px] font-bold hover:underline transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to N/A</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving || isExtracting}
                className="btn-editorial-outline disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || isExtracting}
                className="btn-editorial bg-[#2D7A53] hover:bg-[#236142] py-2.5 px-6 font-bold flex items-center gap-2 text-white shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Saving to Database...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Evidence Entry</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
}

