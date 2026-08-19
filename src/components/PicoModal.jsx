import React, { useState } from 'react';
import { X, Sparkles, Plus, Save, Download } from 'lucide-react';

export default function PicoModal({ 
  isOpen, 
  onClose, 
  pico, 
  onSavePico, 
  icList, 
  ecList 
}) {
  const [picoData, setPicoData] = useState(pico || {
    P: 'Vietnamese SMS, chat messages, and financial scam text lures',
    I: 'In-context Few-Shot LLM Prompting (GPT-4o-mini, Gemini-1.5-Flash)',
    C: 'Fine-tuned Vietnamese Pretrained Language Models (PhoBERT-base, ViDeBERTa)',
    O: 'Macro-F1, Precision, Recall, Specificity, Latency (ms/sample), Token Cost ($)'
  });

  const [icItems, setIcItems] = useState(icList || []);
  const [ecItems, setEcItems] = useState(ecList || []);

  if (!isOpen) return null;

  const handlePicoChange = (field, value) => {
    setPicoData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddIC = () => {
    const newNum = icItems.length + 1;
    setIcItems([...icItems, `IC${newNum}: New inclusion criterion specification`]);
  };

  const handleAddEC = () => {
    const newNum = ecItems.length + 1;
    setEcItems([...ecItems, `EC${newNum}: New exclusion criterion specification`]);
  };

  const handleSuggestAi = () => {
    setIcItems([
      'IC1: Studies evaluating text classification on LLM vs fine-tuned PLM architectures',
      'IC2: Peer-reviewed publications in cybersecurity, NLP, or computational linguistics',
      'IC3: Studies reporting empirical performance metrics (Macro-F1, Precision, Recall)',
      'IC4: Research analyzing short-text message threats, phishing, or scam lures',
      'IC5: Papers providing reproducible evaluation setups or baseline code repositories'
    ]);
    setEcItems([
      'EC1: Papers focusing solely on non-textual network packet security or hardware firewalls',
      'EC2: Publications lacking empirical experimental validation or non-reproducible studies',
      'EC3: Non-English and non-Vietnamese language papers',
      'EC4: Duplicate publications or superseded preprints',
      'EC5: Purely theoretical position papers without benchmark classification metrics'
    ]);
  };

  const handleSave = () => {
    onSavePico({
      pico: picoData,
      ic: icItems,
      ec: ecItems
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none overflow-y-auto">
      <div className="bg-[#9B9483] text-[#1A1917] border-2 border-[#1A1917] max-w-5xl w-full shadow-[8px_8px_0px_0px_rgba(26,25,23,0.8)] overflow-hidden my-8">
        
        {/* Header (Matching Image 4) */}
        <div className="bg-[#8C8574] px-6 py-3 border-b border-[#7A7465] flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#D94E28] font-bold">
              BUG REPORT QUALITY LLM / RESEARCH COLLECTION
            </div>
            <h2 className="font-serif text-2xl font-bold text-[#1A1917]">
              PICO Framework + IC / EC Criteria
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSuggestAi}
              className="bg-[#D94E28] hover:bg-[#C4411C] text-white font-mono text-xs uppercase py-1.5 px-3 flex items-center gap-1.5 font-bold shadow-xs border border-[#A83416]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>+ AI Suggest IC/EC</span>
            </button>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-[#7A7465] text-[#1A1917] transition-colors border border-[#6B6557]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 bg-[#A39C8B]">
          
          {/* PICO GRID (Matching Image 4 Layout) */}
          <div className="grid grid-cols-4 gap-3 font-mono text-xs">
            {/* P - POPULATION */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1A1917]">
                <span className="text-[#D94E28] text-base font-serif italic mr-1">P</span> POPULATION
              </label>
              <div className="text-[9px] text-[#4A4843] uppercase mb-1">WHO/WHAT IS STUDIED?</div>
              <textarea
                value={picoData.P}
                onChange={(e) => handlePicoChange('P', e.target.value)}
                rows={3}
                className="w-full bg-[#8C8574] border border-[#7A7465] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28] leading-tight"
              />
            </div>

            {/* I - INTERVENTION */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1A1917]">
                <span className="text-[#D94E28] text-base font-serif italic mr-1">I</span> INTERVENTION
              </label>
              <div className="text-[9px] text-[#4A4843] uppercase mb-1">TECHNIQUE OR APPROACH?</div>
              <textarea
                value={picoData.I}
                onChange={(e) => handlePicoChange('I', e.target.value)}
                rows={3}
                className="w-full bg-[#8C8574] border border-[#7A7465] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28] leading-tight"
              />
            </div>

            {/* C - COMPARISON */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1A1917]">
                <span className="text-[#D94E28] text-base font-serif italic mr-1">C</span> COMPARISON
              </label>
              <div className="text-[9px] text-[#4A4843] uppercase mb-1">COMPARED AGAINST WHAT?</div>
              <textarea
                value={picoData.C}
                onChange={(e) => handlePicoChange('C', e.target.value)}
                rows={3}
                className="w-full bg-[#8C8574] border border-[#7A7465] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28] leading-tight"
              />
            </div>

            {/* O - OUTCOME */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1A1917]">
                <span className="text-[#D94E28] text-base font-serif italic mr-1">O</span> OUTCOME
              </label>
              <div className="text-[9px] text-[#4A4843] uppercase mb-1">WHAT IS MEASURED?</div>
              <textarea
                value={picoData.O}
                onChange={(e) => handlePicoChange('O', e.target.value)}
                rows={3}
                className="w-full bg-[#8C8574] border border-[#7A7465] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28] leading-tight"
              />
            </div>
          </div>

          {/* CRITERIA COLUMNS: INCLUSION vs EXCLUSION (Matching Image 4) */}
          <div className="grid grid-cols-2 gap-6 pt-2 font-mono text-xs">
            
            {/* INCLUSION CRITERIA (IC) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold uppercase tracking-wider text-[#4299E1]">
                    INCLUSION CRITERIA (IC)
                  </h3>
                  <p className="text-[10px] text-[#4A4843]">Papers must satisfy ALL IC to be included</p>
                </div>
              </div>

              <div className="space-y-2">
                {icItems.map((ic, idx) => (
                  <div key={idx} className="bg-[#8C8574] border border-[#7A7465] p-2.5 flex items-center justify-between">
                    <span className="text-xs text-[#1A1917] leading-snug">{ic}</span>
                    <button 
                      onClick={() => setIcItems(icItems.filter((_, i) => i !== idx))}
                      className="text-[#7A7465] hover:text-[#D94E28] ml-2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleAddIC}
                  className="font-mono text-xs uppercase text-[#1A1917] hover:underline flex items-center gap-1"
                >
                  + Add IC
                </button>
              </div>
            </div>

            {/* EXCLUSION CRITERIA (EC) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold uppercase tracking-wider text-[#D94E28]">
                    EXCLUSION CRITERIA (EC)
                  </h3>
                  <p className="text-[10px] text-[#4A4843]">Papers matching ANY EC are excluded</p>
                </div>
              </div>

              <div className="space-y-2">
                {ecItems.map((ec, idx) => (
                  <div key={idx} className="bg-[#8C8574] border border-[#7A7465] p-2.5 flex items-center justify-between">
                    <span className="text-xs text-[#1A1917] leading-snug">{ec}</span>
                    <button 
                      onClick={() => setEcItems(ecItems.filter((_, i) => i !== idx))}
                      className="text-[#7A7465] hover:text-[#D94E28] ml-2"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleAddEC}
                  className="font-mono text-xs uppercase text-[#1A1917] hover:underline flex items-center gap-1"
                >
                  + Add EC
                </button>
              </div>
            </div>

          </div>

          {/* ACTION BUTTONS (Matching Image 4 Bottom Bar) */}
          <div className="flex items-center justify-between border-t border-[#7A7465] pt-4 font-mono text-xs">
            <button
              type="button"
              onClick={handleSave}
              className="bg-[#D94E28] hover:bg-[#C4411C] text-white font-bold py-2.5 px-6 uppercase tracking-wider flex items-center gap-2 shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>Save All (PICO + {icItems.length} IC + {ecItems.length} EC)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="font-mono text-xs text-[#4A4843] hover:text-[#1A1917] uppercase tracking-wider"
            >
              Cancel
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
