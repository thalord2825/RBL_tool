import React, { useState, useEffect } from 'react';
import { X, Download, GitCommit, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '../services/apiClient';

export default function ExportModal({ 
  isOpen, 
  onClose, 
  gitSettings, 
  searchQuery, 
  sources 
}) {
  const [activeTab, setActiveTab] = useState('01_all_records.csv');
  const [generatedFiles, setGeneratedFiles] = useState({});
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState(null); // { status: 'success'|'error', msg: '' }

  useEffect(() => {
    if (isOpen) {
      fetchExportFiles();
    }
  }, [isOpen]);

  const fetchExportFiles = async () => {
    setIsLoadingFiles(true);
    setCommitResult(null);
    try {
      const res = await apiClient.exportFiles({
        authorName: gitSettings.authorName || 'Nguyen Trung Hieu',
        searchQuery: searchQuery || '("phishing" OR "scam") AND ("LLM" OR "PhoBERT")',
        sources: sources || ['ArXiv', 'OpenAlex', 'Semantic Scholar'],
      });
      setGeneratedFiles(res.files || {});
    } catch (err) {
      console.error('Failed to generate export files:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  if (!isOpen) return null;

  const handleDownloadSingle = (filename, content) => {
    const blob = new Blob([content], { type: filename.endsWith('.csv') ? 'text/csv' : 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    Object.entries(generatedFiles).forEach(([filename, content]) => {
      handleDownloadSingle(filename, content);
    });
  };

  const handleGitCommit = async () => {
    if (!gitSettings.githubToken) {
      setCommitResult({
        status: 'error',
        msg: 'GitHub Token is missing. Please enter your Personal Access Token in Git Config.'
      });
      return;
    }

    setIsCommitting(true);
    setCommitResult(null);
    try {
      const res = await apiClient.commitToGithub({
        repoOwner: gitSettings.repoOwner,
        repoName: gitSettings.repoName,
        branch: gitSettings.branch,
        memberPath: gitSettings.memberPath,
        commitPrefix: gitSettings.commitPrefix,
        githubToken: gitSettings.githubToken,
        authorName: gitSettings.authorName || 'Nguyen Trung Hieu',
        searchQuery,
        sources,
      });

      setCommitResult({
        status: 'success',
        msg: res.message,
        url: res.commit_url
      });
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message || 'Commit failed.';
      setCommitResult({
        status: 'error',
        msg: errMsg
      });
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none overflow-y-auto">
      <div className="bg-[#F4F1EA] border-2 border-[#1A1917] max-w-4xl w-full shadow-[8px_8px_0px_0px_rgba(26,25,23,0.8)] overflow-hidden my-6">
        
        {/* Header */}
        <div className="bg-[#EDE9DF] px-6 py-3 border-b border-[#DCD6C5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-[#2D7A53]" />
            <div>
              <div className="font-mono text-[10px] text-[#7A766F] uppercase tracking-widest font-bold">
                RBL Exporter & Single Atomic Git Engine
              </div>
              <h2 className="font-serif text-xl font-bold text-[#1A1917]">
                SLR Deliverables & 1-Click Atomic Commit
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

        {/* Commit Target Banner */}
        <div className="bg-[#E2DEC9] px-6 py-2 border-b border-[#DCD6C5] font-mono text-[11px] flex items-center justify-between text-[#1A1917]">
          <div className="flex items-center gap-2">
            <GitCommit className="w-3.5 h-3.5 text-[#D94E28]" />
            <span>Target: <strong>{gitSettings.repoOwner}/{gitSettings.repoName}</strong> ({gitSettings.branch})</span>
            <span className="text-[#7A766F]">→ Path: <code className="text-[#D94E28]">{gitSettings.memberPath}</code></span>
          </div>
          <span className="text-[10px] bg-[#D94E28] text-white px-2 py-0.5 font-bold uppercase">
            {gitSettings.commitPrefix || '[SLR]'} (Single Atomic Commit)
          </span>
        </div>

        {/* Commit Feedback Alert */}
        {commitResult && (
          <div className={`px-6 py-3 border-b font-mono text-xs flex items-center justify-between ${
            commitResult.status === 'success'
              ? 'bg-[#D4EBD9] text-[#2D7A53] border-[#98D4A5]'
              : 'bg-[#FADBD8] text-[#C93B2B] border-[#F5B7B1]'
          }`}>
            <div className="flex items-center gap-2">
              {commitResult.status === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{commitResult.msg}</span>
              {commitResult.url && (
                <a href={commitResult.url} target="_blank" rel="noopener noreferrer" className="underline font-bold ml-2">
                  View on GitHub
                </a>
              )}
            </div>
            <button onClick={() => setCommitResult(null)} className="text-current font-bold hover:underline">Dismiss</button>
          </div>
        )}

        {/* Main Content */}
        <div className="p-6 space-y-4 font-mono text-xs">
          
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-[#DCD6C5] overflow-x-auto pb-1">
            {Object.keys(generatedFiles).map((filename) => (
              <button
                key={filename}
                onClick={() => setActiveTab(filename)}
                className={`px-3 py-1.5 font-mono text-[11px] font-bold border transition-all shrink-0 ${
                  activeTab === filename
                    ? 'bg-[#1A1917] text-white border-[#1A1917]'
                    : 'bg-[#EDE9DF] hover:bg-[#E2DEC9] text-[#4A4843] border-[#C8C1AE]'
                }`}
              >
                {filename}
              </button>
            ))}
          </div>

          {/* File Content Box */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-[#1A1917] uppercase">PREVIEW: {activeTab}</span>
              {generatedFiles[activeTab] && (
                <button
                  onClick={() => handleDownloadSingle(activeTab, generatedFiles[activeTab])}
                  className="text-[#D94E28] hover:underline flex items-center gap-1 font-bold text-[10px]"
                >
                  <Download className="w-3 h-3" />
                  <span>Download {activeTab}</span>
                </button>
              )}
            </div>
            
            {isLoadingFiles ? (
              <div className="p-12 text-center text-[#7A766F] bg-[#1A1917] text-white flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#D94E28]" />
                <span>Generating genuine RBL files from SQLite database...</span>
              </div>
            ) : (
              <pre className="bg-[#1A1917] text-[#D4EBD9] p-4 text-[11px] font-mono rounded-none border border-[#2C2B29] max-h-72 overflow-y-auto leading-relaxed selection:bg-[#D94E28]">
                {generatedFiles[activeTab] || 'No content generated.'}
              </pre>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-[#DCD6C5]">
            <button
              onClick={handleDownloadAll}
              className="btn-editorial-outline text-[11px] flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download All 6 Files</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-editorial-outline"
              >
                Close
              </button>

              <button
                type="button"
                onClick={handleGitCommit}
                disabled={isCommitting || isLoadingFiles}
                className="btn-editorial bg-[#2D7A53] hover:bg-[#236142] py-2.5 px-6 font-bold flex items-center gap-2 text-white border-[#1E5237] disabled:opacity-50"
              >
                {isCommitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCommit className="w-4 h-4" />}
                <span>{isCommitting ? 'Committing via Trees API...' : '1-Click Single Atomic Commit'}</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
