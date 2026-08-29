import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  GitMerge,
  Layers,
  FileCheck2,
  AlertTriangle,
  Download,
  Database,
  ArrowRight,
  Sparkles,
  ExternalLink,
  BookOpen,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  TrendingUp,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import apiClient from '../services/apiClient';

export default function TeamMergeModal({ isOpen, onClose, onCorpusSynced }) {
  const [repoPath, setRepoPath] = useState('C:\\Users\\USER\\RBL_ScamShield');
  const [members, setMembers] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [mergeResult, setMergeResult] = useState(null);
  const [activeTab, setActiveTab] = useState('matrix'); // 'matrix' | 'gaps' | 'duplicates'
  const [searchQuery, setSearchQuery] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadMembers();
    }
  }, [isOpen]);

  const loadMembers = async () => {
    try {
      setIsLoadingMembers(true);
      const data = await apiClient.getTeamMembers(repoPath);
      if (data && data.members) {
        setMembers(data.members);
      }
    } catch (err) {
      console.error('Failed to load team members:', err);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleRunMerge = async () => {
    try {
      setIsMerging(true);
      setSuccessMsg('');
      const data = await apiClient.mergeTeamCorpus(repoPath);
      setMergeResult(data);
      setSuccessMsg(`✓ Successfully deduplicated and merged ${data.unique_master_count} master papers!`);
    } catch (err) {
      console.error('Failed to merge team SLR:', err);
      alert(`Merge failed: ${err.message}`);
    } finally {
      setIsMerging(false);
    }
  };

  const handleSyncToActiveCorpus = async () => {
    try {
      setIsSyncing(true);
      const data = await apiClient.syncTeamToCorpus(repoPath);
      setSuccessMsg(`✓ Successfully imported ${data.imported_count} Master Included papers into active project corpus!`);
      if (onCorpusSynced) {
        onCorpusSynced(data.papers);
      }
    } catch (err) {
      console.error('Failed to sync master papers:', err);
      alert(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  const filteredPapers = mergeResult?.master_papers?.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.title?.toLowerCase().includes(q) ||
      p.master_id?.toLowerCase().includes(q) ||
      p.tool_model?.toLowerCase().includes(q) ||
      p.contributors?.some(c => c.toLowerCase().includes(q))
    );
  }) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#FAF8F5] dark:bg-[#1C1B1A] border border-[#E6E2DE] dark:border-[#2E2C29] rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 bg-white dark:bg-[#232220] border-b border-[#E6E2DE] dark:border-[#2E2C29] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <GitMerge className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#1A1917] dark:text-[#F5F3EF]">
                  Team SLR Merger & Master Evidence Synthesis
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  ScamShield RBL
                </span>
              </div>
              <p className="text-xs text-[#706E6B] dark:text-[#A8A5A0]">
                Cross-Member Deduplication, 7-Column Matrix Merge, and Grounded Research Gap Synthesis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#706E6B] hover:text-[#1A1917] dark:text-[#A8A5A0] dark:hover:text-[#F5F3EF] hover:bg-[#F0EDE8] dark:hover:bg-[#2E2C29] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Repository & Team Member Overview */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#706E6B] dark:text-[#A8A5A0] flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600" />
                Team Researcher Streams (5 Members)
              </h3>
              <button
                onClick={loadMembers}
                disabled={isLoadingMembers}
                className="text-xs text-[#706E6B] hover:text-emerald-600 dark:text-[#A8A5A0] flex items-center gap-1 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMembers ? 'animate-spin' : ''}`} />
                Rescan Folders
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {members.map(m => (
                <div
                  key={m.member_key}
                  className={`p-3.5 rounded-xl border transition-all ${
                    m.exists
                      ? 'bg-white dark:bg-[#232220] border-[#E6E2DE] dark:border-[#2E2C29] hover:border-emerald-500/40'
                      : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-xs text-[#1A1917] dark:text-[#F5F3EF] truncate">
                      {m.display_name}
                    </span>
                    {m.has_evidence_table && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" title="Evidence table extracted" />
                    )}
                  </div>
                  <div className="space-y-1 text-[11px] text-[#706E6B] dark:text-[#A8A5A0]">
                    <div className="flex justify-between">
                      <span>Raw records:</span>
                      <span className="font-mono font-bold text-[#1A1917] dark:text-[#F5F3EF]">{m.total_records}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Included:</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{m.included_count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action & Stats Control Bar */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#232220] border border-[#E6E2DE] dark:border-[#2E2C29] flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={handleRunMerge}
                disabled={isMerging}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl flex items-center gap-2 shadow-sm transition-all"
              >
                {isMerging ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Deduplicating & Merging...
                  </>
                ) : (
                  <>
                    <GitMerge className="w-4 h-4" />
                    Merge & Deduplicate All Streams
                  </>
                )}
              </button>

              {mergeResult && (
                <button
                  onClick={handleSyncToActiveCorpus}
                  disabled={isSyncing}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl flex items-center gap-2 shadow-sm transition-all"
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Importing to SQLite...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" />
                      Import Master Corpus into Active View
                    </>
                  )}
                </button>
              )}
            </div>

            {mergeResult && (
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 text-[#706E6B] dark:text-[#A8A5A0]">
                  <span>Candidate Inclusions:</span>
                  <span className="font-mono font-bold text-[#1A1917] dark:text-[#F5F3EF]">
                    {mergeResult.total_candidate_inclusions}
                  </span>
                </div>
                <div className="w-px h-4 bg-[#E6E2DE] dark:bg-[#2E2C29]" />
                <div className="flex items-center gap-1.5 text-[#706E6B] dark:text-[#A8A5A0]">
                  <span>Duplicates Eliminated:</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    {mergeResult.duplicates_eliminated}
                  </span>
                </div>
                <div className="w-px h-4 bg-[#E6E2DE] dark:bg-[#2E2C29]" />
                <div className="flex items-center gap-1.5 text-[#706E6B] dark:text-[#A8A5A0]">
                  <span>Unique Master Papers:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {mergeResult.unique_master_count}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Success Banner */}
          {successMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-xl text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Tab Navigation */}
          {mergeResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#E6E2DE] dark:border-[#2E2C29] pb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('matrix')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      activeTab === 'matrix'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                        : 'text-[#706E6B] hover:text-[#1A1917] dark:text-[#A8A5A0]'
                    }`}
                  >
                    Master Evidence Matrix ({mergeResult.unique_master_count})
                  </button>
                  <button
                    onClick={() => setActiveTab('gaps')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      activeTab === 'gaps'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                        : 'text-[#706E6B] hover:text-[#1A1917] dark:text-[#A8A5A0]'
                    }`}
                  >
                    Master Gap Analysis (5 Core Gaps)
                  </button>
                  <button
                    onClick={() => setActiveTab('duplicates')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                      activeTab === 'duplicates'
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                        : 'text-[#706E6B] hover:text-[#1A1917] dark:text-[#A8A5A0]'
                    }`}
                  >
                    Cross-Member Duplicates ({mergeResult.duplicates_eliminated})
                  </button>
                </div>

                {activeTab === 'matrix' && (
                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#706E6B] dark:text-[#A8A5A0]" />
                    <input
                      type="text"
                      placeholder="Filter master papers..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 text-xs bg-white dark:bg-[#232220] border border-[#E6E2DE] dark:border-[#2E2C29] rounded-lg text-[#1A1917] dark:text-[#F5F3EF] focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}
              </div>

              {/* Tab 1: Master Matrix Table */}
              {activeTab === 'matrix' && (
                <div className="bg-white dark:bg-[#232220] border border-[#E6E2DE] dark:border-[#2E2C29] rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto max-h-[480px]">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-[#FAF8F5] dark:bg-[#1C1B1A] text-[#706E6B] dark:text-[#A8A5A0] uppercase font-bold sticky top-0 border-b border-[#E6E2DE] dark:border-[#2E2C29] z-10">
                        <tr>
                          <th className="py-2.5 px-3">Master ID</th>
                          <th className="py-2.5 px-3">Title & Year</th>
                          <th className="py-2.5 px-3">Contributors</th>
                          <th className="py-2.5 px-3">Tool / LLM</th>
                          <th className="py-2.5 px-3">Dataset</th>
                          <th className="py-2.5 px-3">Empirical Results</th>
                          <th className="py-2.5 px-3">Limitations</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E6E2DE] dark:divide-[#2E2C29]">
                        {filteredPapers.map(p => (
                          <tr key={p.master_id} className="hover:bg-[#FAF8F5] dark:hover:bg-[#282725] transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {p.master_id}
                            </td>
                            <td className="py-2.5 px-3 max-w-[240px]">
                              <div className="font-semibold text-[#1A1917] dark:text-[#F5F3EF] truncate" title={p.title}>
                                {p.url ? (
                                  <a href={p.url} target="_blank" rel="noreferrer" className="hover:underline text-indigo-600 dark:text-indigo-400">
                                    {p.title}
                                  </a>
                                ) : (
                                  p.title
                                )}
                              </div>
                              <div className="text-[10px] text-[#706E6B] dark:text-[#A8A5A0] truncate">
                                {p.year} • {p.venue}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex flex-wrap gap-1">
                                {p.contributors?.map(c => (
                                  <span key={c} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#F0EDE8] dark:bg-[#2E2C29] text-[#706E6B] dark:text-[#A8A5A0]">
                                    {c.replace('_', ' ')}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 max-w-[140px] truncate text-[#706E6B] dark:text-[#A8A5A0]" title={p.tool_model}>
                              {p.tool_model}
                            </td>
                            <td className="py-2.5 px-3 max-w-[120px] truncate text-[#706E6B] dark:text-[#A8A5A0]" title={p.dataset_name}>
                              {p.dataset_name}
                            </td>
                            <td className="py-2.5 px-3 max-w-[200px] truncate text-[#1A1917] dark:text-[#F5F3EF]" title={p.empirical_results}>
                              {p.empirical_results}
                            </td>
                            <td className="py-2.5 px-3 max-w-[160px] truncate text-[#706E6B] dark:text-[#A8A5A0]" title={p.limitations}>
                              {p.limitations}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 2: Master Gap Analysis */}
              {activeTab === 'gaps' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {
                      id: 'GAP-1',
                      title: '1. Scarcity of Vietnamese Scam Datasets & Teencode Variants',
                      problem: 'International benchmarks (UCI, LSDST) lack Vietnamese language nuances, teencode, zero-width characters, and bank impersonation scripts.',
                      solution: 'ScamShield builds the first public Vietnamese Scam Dataset (>=500 samples) with LLM-based Adversarial Data Augmentation.'
                    },
                    {
                      id: 'GAP-2',
                      title: '2. Accuracy-Latency-Cost Trilemma in Real-time Mobile Detection',
                      problem: 'Heavy LLMs take > 2-4s and incur token costs; lightweight models (0.25ms) degrade heavily on unseen scam variations.',
                      solution: '2-Tier Cascaded AI: Fast-Path PhoBERT CPU (< 250ms, WBCE loss) + Cloud Gemini Few-Shot reasoning for unsure cases.'
                    },
                    {
                      id: 'GAP-3',
                      title: '3. Multimodal Threat Blindness (QR Codes & Image Phishing)',
                      problem: 'Modern fraudsters bypass plain-text NLP filters by sending QR codes (Quishing) and screenshot notices (fake bank receipts).',
                      solution: 'Integrated OCR Engine (Tesseract/PaddleOCR) and QR URL decoder cross-referenced against ScamShield Blacklist.'
                    },
                    {
                      id: 'GAP-4',
                      title: '4. Single-Message Isolation vs. Multi-Turn Conversation Progression',
                      problem: 'Traditional classifiers only evaluate isolated messages, failing to detect slow-burn recruitment/investment fraud scripts.',
                      solution: 'Full conversation thread analysis (Zalo, Messenger) detecting psychological manipulation and escalation.'
                    },
                    {
                      id: 'GAP-5',
                      title: '5. Disconnect Between Static AI Classifiers and Real-Time Community Intel',
                      problem: 'Static offline models fail against zero-day campaigns until retrained months later.',
                      solution: 'Community-Reported Blacklist with Moderator Review, Threat Heatmap, and real-time community safety alerts.'
                    }
                  ].map(gap => (
                    <div key={gap.id} className="p-4 rounded-xl bg-white dark:bg-[#232220] border border-[#E6E2DE] dark:border-[#2E2C29] space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {gap.id}
                        </span>
                        <h4 className="text-xs font-bold text-[#1A1917] dark:text-[#F5F3EF]">
                          {gap.title}
                        </h4>
                      </div>
                      <div className="text-[11px] text-[#706E6B] dark:text-[#A8A5A0] space-y-1">
                        <p><strong className="text-red-600 dark:text-red-400">Current Gap:</strong> {gap.problem}</p>
                        <p><strong className="text-emerald-600 dark:text-emerald-400">ScamShield Solution:</strong> {gap.solution}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 3: Duplicates Tab */}
              {activeTab === 'duplicates' && (
                <div className="bg-white dark:bg-[#232220] border border-[#E6E2DE] dark:border-[#2E2C29] rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-bold text-[#1A1917] dark:text-[#F5F3EF] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Cross-Member Duplicate Resolution Log ({mergeResult.duplicates_eliminated} duplicates eliminated)
                  </h4>
                  {mergeResult.duplicate_details?.map((d, i) => (
                    <div key={i} className="p-3 rounded-lg bg-[#FAF8F5] dark:bg-[#1C1B1A] border border-[#E6E2DE] dark:border-[#2E2C29] text-xs flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[#1A1917] dark:text-[#F5F3EF]">{d.duplicate_title}</div>
                        <div className="text-[10px] text-[#706E6B] dark:text-[#A8A5A0]">Found in stream: <span className="font-medium text-amber-600">{d.member}</span></div>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                          Merged into {d.master_id}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-[#FAF8F5] dark:bg-[#1C1B1A] border-t border-[#E6E2DE] dark:border-[#2E2C29] flex items-center justify-between text-xs text-[#706E6B] dark:text-[#A8A5A0]">
          <div>
            Repository: <code className="font-mono text-emerald-600 dark:text-emerald-400">{repoPath}</code>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 font-semibold text-[#1A1917] dark:text-[#F5F3EF] bg-white dark:bg-[#232220] border border-[#E6E2DE] dark:border-[#2E2C29] hover:bg-[#F0EDE8] dark:hover:bg-[#2E2C29] rounded-xl transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
