import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  CheckCircle2, 
  XCircle, 
  Layers, 
  RotateCcw, 
  Download, 
  Upload, 
  Plus, 
  Trash2, 
  Edit3, 
  X, 
  Save, 
  Info,
  BookOpen
} from 'lucide-react';

export const DEFAULT_PICO = {
  P: 'Scam messages (SMS, Zalo, Messenger, Email) and fraudulent call scripts targeting users, particularly within the context of the Vietnamese language and community alert platforms.',
  I: 'Text classification based on Large Language Models (LLMs) utilizing In-context Learning techniques (Zero-shot, Few-shot, Few-shot + taxonomy) integrated into software systems.',
  C: 'Fine-tuned Pre-trained Language Models (such as PhoBERT) and traditional filtering mechanisms based on blacklists or keyword matching.',
  O: 'Classification performance (Accuracy, Precision, Recall, Macro-F1 per scam category), system inference latency (< 3 seconds), and API token cost (Cost per request).'
};

export const DEFAULT_IC_LIST = [
  'IC1: Studies focusing on the detection and classification of spam messages, scam messages (phishing/smishing), or fraud via conversational scripts.',
  'IC2: Papers that apply or evaluate Large Language Models (LLMs via prompting) or Pre-trained Language Models (PLMs like BERT, PhoBERT).',
  'IC3: Studies providing clear empirical results with metrics such as Accuracy, Precision, Recall, F1-score, inference latency, or computational cost.',
  'IC4: Papers discussing system architecture, integrating AI into real-world platforms (web/mobile apps), or community alert mechanisms (crowdsourcing/blacklist).',
  'IC5: Studies published from 2020 onwards.'
];

export const DEFAULT_EC_LIST = [
  'EC1: Studies focusing solely on malware analysis, or pure URL identification via hash algorithms without semantic text analysis.',
  'EC2: Papers dealing with acoustic voice/audio processing to detect fraudulent calls rather than processing text/scripts.',
  'EC3: Studies that do not utilize Machine Learning, LLMs, or PLMs (e.g., relying entirely on classical rule-based methods).',
  'EC4: Purely theoretical or vision papers lacking experimental datasets, practical implementations, or empirical evaluation.',
  'EC5: Papers not written in English, or where the full-text is inaccessible.'
];

export default function ProtocolSettingsModal({
  isOpen,
  onClose,
  pico: initialPico,
  icList: initialIcList,
  ecList: initialEcList,
  onSaveProtocol
}) {
  const [activeTab, setActiveTab] = useState('PICO'); // 'PICO' | 'IC' | 'EC'
  const [pico, setPico] = useState(DEFAULT_PICO);
  const [icList, setIcList] = useState(DEFAULT_IC_LIST);
  const [ecList, setEcList] = useState(DEFAULT_EC_LIST);
  const [newIcText, setNewIcText] = useState('');
  const [newEcText, setNewEcText] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    if (initialPico) setPico(initialPico);
    if (initialIcList) setIcList(initialIcList);
    if (initialEcList) setEcList(initialEcList);
  }, [initialPico, initialIcList, initialEcList, isOpen]);

  if (!isOpen) return null;

  // Add new IC
  const handleAddIc = () => {
    if (!newIcText.trim()) return;
    const nextNum = icList.length + 1;
    const rule = newIcText.startsWith('IC') ? newIcText.trim() : `IC${nextNum}: ${newIcText.trim()}`;
    setIcList(prev => [...prev, rule]);
    setNewIcText('');
  };

  // Add new EC
  const handleAddEc = () => {
    if (!newEcText.trim()) return;
    const nextNum = ecList.length + 1;
    const rule = newEcText.startsWith('EC') ? newEcText.trim() : `EC${nextNum}: ${newEcText.trim()}`;
    setEcList(prev => [...prev, rule]);
    setNewEcText('');
  };

  // Delete IC
  const handleDeleteIc = (index) => {
    if (icList.length <= 1) {
      alert('At least 1 Inclusion Criterion is required.');
      return;
    }
    setIcList(prev => prev.filter((_, i) => i !== index));
  };

  // Delete EC
  const handleDeleteEc = (index) => {
    if (ecList.length <= 1) {
      alert('At least 1 Exclusion Criterion is required.');
      return;
    }
    setEcList(prev => prev.filter((_, i) => i !== index));
  };

  // Start Editing
  const startEdit = (type, index, text) => {
    setEditingIndex({ type, index });
    setEditText(text);
  };

  // Save Edit
  const saveEdit = () => {
    if (!editingIndex || !editText.trim()) return;
    const { type, index } = editingIndex;
    if (type === 'IC') {
      setIcList(prev => prev.map((item, i) => i === index ? editText.trim() : item));
    } else if (type === 'EC') {
      setEcList(prev => prev.map((item, i) => i === index ? editText.trim() : item));
    }
    setEditingIndex(null);
    setEditText('');
  };

  // Reset to RBL Defaults
  const handleResetDefaults = () => {
    if (window.confirm('Reset all PICO, IC, and EC criteria to RBL ScamShield defaults?')) {
      setPico(DEFAULT_PICO);
      setIcList(DEFAULT_IC_LIST);
      setEcList(DEFAULT_EC_LIST);
    }
  };

  // Export JSON
  const handleExportJson = () => {
    const data = {
      protocol_version: '1.0',
      exported_at: new Date().toISOString(),
      pico,
      ic_list: icList,
      ec_list: ecList
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slr_research_protocol_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON
  const handleImportJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.pico) setPico(data.pico);
        if (Array.isArray(data.ic_list)) setIcList(data.ic_list);
        if (Array.isArray(data.ec_list)) setEcList(data.ec_list);
        alert('Protocol JSON imported successfully!');
      } catch (err) {
        alert(`Failed to parse protocol JSON: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Save All
  const handleSaveAll = () => {
    onSaveProtocol({ pico, icList, ecList });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none animate-in fade-in duration-200">
      <div className="bg-[#F4F1EA] border-2 border-[#1A1917] max-w-3xl w-full shadow-[8px_8px_0px_0px_rgba(26,25,23,0.85)] overflow-hidden font-mono flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-[#1A1917] text-[#F4F1EA] px-6 py-3 border-b-2 border-[#1A1917] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-[#D94E28]" />
            <div>
              <span className="text-[10px] text-[#A09B8E] uppercase tracking-widest block font-bold">
                PRISMA 2020 Protocol Specification
              </span>
              <h2 className="font-serif text-lg font-bold text-white tracking-wide">
                Research Protocol Manager (PICO • IC • EC)
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#33312E] text-[#A09B8E] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-[#EDE9DF] border-b border-[#DCD6C5] px-6 flex items-center justify-between shrink-0">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('PICO')}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
                activeTab === 'PICO'
                  ? 'border-[#D94E28] text-[#D94E28] bg-[#F4F1EA]'
                  : 'border-transparent text-[#7A766F] hover:text-[#1A1917]'
              }`}
            >
              1. PICO Framework
            </button>

            <button
              onClick={() => setActiveTab('IC')}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === 'IC'
                  ? 'border-[#2D7A53] text-[#2D7A53] bg-[#F4F1EA]'
                  : 'border-transparent text-[#7A766F] hover:text-[#1A1917]'
              }`}
            >
              <span>2. Inclusion Criteria (IC)</span>
              <span className="bg-[#D4EBD9] text-[#2D7A53] px-1.5 py-0.2 text-[9.5px] rounded">
                {icList.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('EC')}
              className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === 'EC'
                  ? 'border-[#C93B2B] text-[#C93B2B] bg-[#F4F1EA]'
                  : 'border-transparent text-[#7A766F] hover:text-[#1A1917]'
              }`}
            >
              <span>3. Exclusion Criteria (EC)</span>
              <span className="bg-[#FADBD8] text-[#C93B2B] px-1.5 py-0.2 text-[9.5px] rounded">
                {ecList.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={handleExportJson}
              className="text-[#7A766F] hover:text-[#1A1917] flex items-center gap-1 px-2 py-1 hover:bg-[#DCD6C5] transition-colors"
              title="Export criteria to JSON"
            >
              <Download className="w-3 h-3" />
              <span>Export</span>
            </button>

            <label className="text-[#7A766F] hover:text-[#1A1917] flex items-center gap-1 px-2 py-1 hover:bg-[#DCD6C5] transition-colors cursor-pointer" title="Import criteria from JSON">
              <Upload className="w-3 h-3" />
              <span>Import</span>
              <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
            </label>
          </div>
        </div>

        {/* Scrollable Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: PICO FRAMEWORK */}
          {activeTab === 'PICO' && (
            <div className="space-y-4 text-xs">
              <div className="bg-[#EFECE4] border border-[#DCD6C5] p-3 text-[#4A4843] flex items-start gap-2">
                <Info className="w-4 h-4 text-[#D94E28] shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  The <strong>PICO Framework</strong> governs systematic eligibility across Population, Intervention, Comparison, and Outcome benchmarks. These parameters are directly injected into the Gemini AI Batch Screening Prompt.
                </p>
              </div>

              {/* P */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-[#1A1917] flex items-center gap-1">
                    <span className="bg-[#1A1917] text-white px-1.5 py-0.2 text-[10px]">P</span>
                    <span>Population / Problem:</span>
                  </label>
                  <span className="text-[10px] text-[#7A766F]">{pico.P?.length || 0} chars</span>
                </div>
                <textarea
                  rows={2}
                  value={pico.P || ''}
                  onChange={(e) => setPico(prev => ({ ...prev, P: e.target.value }))}
                  placeholder="Target corpus, language, text lure domain..."
                  className="w-full bg-[#FDFCF9] border border-[#C8C1AE] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28]"
                />
              </div>

              {/* I */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-[#1A1917] flex items-center gap-1">
                    <span className="bg-[#2D7A53] text-white px-1.5 py-0.2 text-[10px]">I</span>
                    <span>Intervention / Technique:</span>
                  </label>
                  <span className="text-[10px] text-[#7A766F]">{pico.I?.length || 0} chars</span>
                </div>
                <textarea
                  rows={2}
                  value={pico.I || ''}
                  onChange={(e) => setPico(prev => ({ ...prev, I: e.target.value }))}
                  placeholder="LLM Prompting, Few-Shot, Zero-Shot, In-Context Learning..."
                  className="w-full bg-[#FDFCF9] border border-[#C8C1AE] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#2D7A53]"
                />
              </div>

              {/* C */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-[#1A1917] flex items-center gap-1">
                    <span className="bg-[#B8860B] text-white px-1.5 py-0.2 text-[10px]">C</span>
                    <span>Comparison / Baselines:</span>
                  </label>
                  <span className="text-[10px] text-[#7A766F]">{pico.C?.length || 0} chars</span>
                </div>
                <textarea
                  rows={2}
                  value={pico.C || ''}
                  onChange={(e) => setPico(prev => ({ ...prev, C: e.target.value }))}
                  placeholder="Fine-tuned PLMs (PhoBERT, ViDeBERTa, DistilBERT), traditional ML..."
                  className="w-full bg-[#FDFCF9] border border-[#C8C1AE] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#B8860B]"
                />
              </div>

              {/* O */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-[#1A1917] flex items-center gap-1">
                    <span className="bg-[#C93B2B] text-white px-1.5 py-0.2 text-[10px]">O</span>
                    <span>Outcome / Target Metrics:</span>
                  </label>
                  <span className="text-[10px] text-[#7A766F]">{pico.O?.length || 0} chars</span>
                </div>
                <textarea
                  rows={2}
                  value={pico.O || ''}
                  onChange={(e) => setPico(prev => ({ ...prev, O: e.target.value }))}
                  placeholder="Macro-F1, Precision, Recall, Latency ms, Token Cost $..."
                  className="w-full bg-[#FDFCF9] border border-[#C8C1AE] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#C93B2B]"
                />
              </div>
            </div>
          )}

          {/* TAB 2: INCLUSION CRITERIA (IC) */}
          {activeTab === 'IC' && (
            <div className="space-y-4 text-xs">
              <div className="bg-[#EAEFEA] border border-[#BBD7C2] p-3 text-[#1E5237] flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2D7A53] shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Papers must satisfy <strong>all or applicable Inclusion Criteria (IC)</strong> to advance from Title/Abstract screening into the full 7-Column Evidence Extraction Matrix.
                </p>
              </div>

              {/* List of ICs */}
              <div className="space-y-2">
                {icList.map((ic, idx) => {
                  const isEditing = editingIndex?.type === 'IC' && editingIndex?.index === idx;

                  return (
                    <div 
                      key={idx}
                      className="bg-[#FDFCF9] border border-[#C8C1AE] p-2.5 flex items-start justify-between gap-3 shadow-2xs group"
                    >
                      {isEditing ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="flex-1 bg-white border border-[#2D7A53] p-1.5 text-xs text-[#1A1917] focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={saveEdit}
                            className="bg-[#2D7A53] text-white px-2 py-1 text-xs font-bold"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingIndex(null)}
                            className="bg-[#EDE9DF] text-[#7A766F] px-2 py-1 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 font-mono text-xs text-[#1A1917] leading-snug">
                            {ic}
                          </div>
                          <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => startEdit('IC', idx, ic)}
                              className="p-1 hover:bg-[#EDE9DF] text-[#7A766F] hover:text-[#1A1917]"
                              title="Edit rule"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteIc(idx)}
                              className="p-1 hover:bg-[#FADBD8] text-[#7A766F] hover:text-[#C93B2B]"
                              title="Delete rule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add new IC */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#DCD6C5]">
                <input
                  type="text"
                  value={newIcText}
                  onChange={(e) => setNewIcText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddIc()}
                  placeholder={`IC${icList.length + 1}: Enter new inclusion criterion...`}
                  className="flex-1 bg-[#FDFCF9] border border-[#C8C1AE] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#2D7A53]"
                />
                <button
                  onClick={handleAddIc}
                  disabled={!newIcText.trim()}
                  className="bg-[#2D7A53] hover:bg-[#236142] text-white px-4 py-2 font-bold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add IC</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: EXCLUSION CRITERIA (EC) */}
          {activeTab === 'EC' && (
            <div className="space-y-4 text-xs">
              <div className="bg-[#FDF2F2] border border-[#F5B7B1] p-3 text-[#991B1B] flex items-start gap-2">
                <XCircle className="w-4 h-4 text-[#C93B2B] shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Meeting any <strong>single Exclusion Criterion (EC)</strong> immediately disqualifies a record. These ECs directly populate both the AI Judge decision matrix and the manual exclusion dropdown modal.
                </p>
              </div>

              {/* List of ECs */}
              <div className="space-y-2">
                {ecList.map((ec, idx) => {
                  const isEditing = editingIndex?.type === 'EC' && editingIndex?.index === idx;

                  return (
                    <div 
                      key={idx}
                      className="bg-[#FDFCF9] border border-[#C8C1AE] p-2.5 flex items-start justify-between gap-3 shadow-2xs group"
                    >
                      {isEditing ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="flex-1 bg-white border border-[#C93B2B] p-1.5 text-xs text-[#1A1917] focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={saveEdit}
                            className="bg-[#C93B2B] text-white px-2 py-1 text-xs font-bold"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingIndex(null)}
                            className="bg-[#EDE9DF] text-[#7A766F] px-2 py-1 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 font-mono text-xs text-[#C93B2B] leading-snug">
                            {ec}
                          </div>
                          <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => startEdit('EC', idx, ec)}
                              className="p-1 hover:bg-[#EDE9DF] text-[#7A766F] hover:text-[#1A1917]"
                              title="Edit rule"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteEc(idx)}
                              className="p-1 hover:bg-[#FADBD8] text-[#7A766F] hover:text-[#C93B2B]"
                              title="Delete rule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add new EC */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#DCD6C5]">
                <input
                  type="text"
                  value={newEcText}
                  onChange={(e) => setNewEcText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddEc()}
                  placeholder={`EC${ecList.length + 1}: Enter new exclusion criterion...`}
                  className="flex-1 bg-[#FDFCF9] border border-[#C8C1AE] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#C93B2B]"
                />
                <button
                  onClick={handleAddEc}
                  disabled={!newEcText.trim()}
                  className="bg-[#C93B2B] hover:bg-[#A82B1D] text-white px-4 py-2 font-bold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add EC</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="bg-[#EDE9DF] px-6 py-3 border-t border-[#DCD6C5] flex items-center justify-between shrink-0 font-mono">
          <button
            onClick={handleResetDefaults}
            className="text-[#7A766F] hover:text-[#C93B2B] flex items-center gap-1.5 text-xs font-bold hover:underline transition-colors"
            title="Reset to ScamShield PhoBERT vs LLM baseline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset RBL Default</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#DCD6C5] hover:bg-[#C8C1AE] text-[#1A1917] text-xs font-bold transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleSaveAll}
              className="px-5 py-1.5 bg-[#D94E28] hover:bg-[#C4411C] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors border border-[#A83416]"
            >
              <Save className="w-4 h-4" />
              <span>Save & Apply Protocol</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
