import React, { useState } from 'react';
import { X, Save, FileText, ExternalLink } from 'lucide-react';

export default function EvidenceExtractionModal({ isOpen, onClose, paper, onSaveExtraction }) {
  const [formData, setFormData] = useState({
    tool_model: paper?.tool_model || 'N/A',
    dataset_name: paper?.dataset_name || 'N/A',
    sample_size_n: paper?.sample_size_n || 'N/A',
    metrics_evaluated: paper?.metrics_evaluated || 'N/A',
    empirical_results: paper?.empirical_results || 'N/A',
    code_url: paper?.code_url || 'N/A',
    limitations: paper?.limitations || 'N/A',
  });

  if (!isOpen || !paper) return null;

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveExtraction(paper.id, formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none overflow-y-auto">
      <div className="bg-[#F4F1EA] border-2 border-[#1A1917] max-w-2xl w-full shadow-[8px_8px_0px_0px_rgba(26,25,23,0.8)] overflow-hidden my-8">
        
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
            {paper.authors} ({paper.year}) • <span className="italic">{paper.venue}</span>
          </div>
        </div>

        {/* Zero Data Fabrication Warning Banner */}
        <div className="bg-[#FEF3C7] px-6 py-2 border-b border-[#FDE68A] font-mono text-[10px] text-[#B8860B] font-bold uppercase">
          Zero Fabrication Policy: If paper omits any metric, leave field as "N/A".
        </div>

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
              placeholder="e.g. PhoBERT-base, GPT-4o-mini (Few-Shot), ViDeBERTa"
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
                placeholder="e.g. ViSFD (Vietnamese Facebook Spam)"
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
                placeholder="e.g. N = 2,540 messages"
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
                placeholder="e.g. PhoBERT: F1=94.1%, GPT-4o: F1=91.5%"
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
              placeholder="e.g. Evaluated only on clean text; does not benchmark Vietnamese teencode variants"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#DCD6C5]">
            <button
              type="button"
              onClick={onClose}
              className="btn-editorial-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-editorial bg-[#2D7A53] hover:bg-[#236142] py-2.5 px-6 font-bold flex items-center gap-2 text-white"
            >
              <Save className="w-4 h-4" />
              <span>Save Evidence Entry</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
