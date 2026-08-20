import React, { useState } from 'react';
import { 
  PlusCircle, 
  Sparkles, 
  Loader2, 
  X, 
  BookOpen, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Clipboard, 
  FileText, 
  Layers, 
  Link as LinkIcon, 
  Calendar, 
  User, 
  Hash,
  RotateCcw
} from 'lucide-react';
import apiClient from '../services/apiClient';

export default function AddPaperManualModal({
  isOpen,
  onClose,
  onPaperAdded
}) {
  const [identifier, setIdentifier] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [fetchSuccess, setFetchSuccess] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [duplicateNotice, setDuplicateNotice] = useState(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [venue, setVenue] = useState('');
  const [abstract, setAbstract] = useState('');
  const [doi, setDoi] = useState('');
  const [url, setUrl] = useState('');
  const [source, setSource] = useState('Manual Entry');
  const [citationsCount, setCitationsCount] = useState(0);
  const [status, setStatus] = useState('PENDING');

  // Reset loading state and clear stale error on open
  React.useEffect(() => {
    if (isOpen) {
      setIsSaving(false);
      setIsFetching(false);
      setFetchError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setIdentifier(text.trim());
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
    }
  };

  const handleFetchMetadata = async (targetId = identifier) => {
    const raw = (targetId || '').trim();
    if (!raw) {
      setFetchError('Please enter a DOI (e.g. 10.1145/3372278.3390678) or paper URL.');
      return;
    }

    setIsFetching(true);
    setFetchError(null);
    setFetchSuccess(null);
    setDuplicateNotice(null);

    try {
      const data = await apiClient.fetchMetadata(raw);
      if (data) {
        if (data.title) setTitle(data.title);
        if (data.authors) setAuthors(data.authors);
        if (data.year) setYear(data.year);
        if (data.venue) setVenue(data.venue);
        if (data.abstract && data.abstract !== 'N/A') setAbstract(data.abstract);
        if (data.doi) setDoi(data.doi);
        if (data.url) setUrl(data.url);
        if (data.source) setSource(data.source);
        if (data.citations_count) setCitationsCount(data.citations_count);

        if (!data.title || data.title === 'Untitled') {
          setFetchError('Metadata was partially retrieved. Please review and enter Title or Abstract below.');
        } else {
          setFetchSuccess(`Successfully resolved: "${data.title.slice(0, 55)}..." from ${data.source || 'Canonical Registry'}`);
        }
      } else {
        setFetchError('No metadata could be parsed. You can still fill in the details manually.');
      }
    } catch (err) {
      setFetchError(err.response?.data?.detail || err.message || 'Failed to auto-fetch metadata. Please enter details manually.');
    } finally {
      setIsFetching(false);
    }
  };

  const handleResetForm = () => {
    setIdentifier('');
    setTitle('');
    setAuthors('');
    setYear(new Date().getFullYear());
    setVenue('');
    setAbstract('');
    setDoi('');
    setUrl('');
    setSource('Manual Entry');
    setCitationsCount(0);
    setStatus('PENDING');
    setFetchError(null);
    setFetchSuccess(null);
    setDuplicateNotice(null);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      setFetchError('Title is required to save a paper.');
      return;
    }

    setIsSaving(true);
    setFetchError(null);

    const paperPayload = {
      title: title.trim(),
      authors: authors.trim() || 'Unknown Authors',
      year: parseInt(year, 10) || new Date().getFullYear(),
      venue: venue.trim(),
      abstract: abstract.trim() || 'N/A',
      doi: doi.trim(),
      url: url.trim() || (doi.trim() ? `https://doi.org/${doi.trim()}` : ''),
      source: source || 'Manual Entry',
      citations_count: parseInt(citationsCount, 10) || 0,
      status: status || 'PENDING'
    };

    try {
      const res = await apiClient.addManualPaper(paperPayload, 'default');
      if (res && res.status === 'success') {
        if (onPaperAdded) {
          onPaperAdded(res.paper, res.papers, res.is_duplicate);
        }
        handleResetForm();
        onClose();
      }
    } catch (err) {
      setFetchError(err.response?.data?.detail || err.message || 'Failed to save paper to database.');
    } finally {
      setIsSaving(false);
    }
  };

  const wordCount = abstract.trim() ? abstract.trim().split(/\s+/).length : 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none animate-in fade-in duration-200">
      <div className="bg-[#F4F1EA] border-2 border-[#1A1917] text-[#1A1917] max-w-2xl w-full shadow-[8px_8px_0px_0px_rgba(26,25,23,0.85)] overflow-hidden font-mono flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-[#1A1917] text-[#F4F1EA] px-6 py-3.5 border-b-2 border-[#1A1917] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 text-[#D94E28]">
            <PlusCircle className="w-5 h-5" />
            <div>
              <span className="text-[10px] text-[#A09B8E] uppercase tracking-widest block font-bold">
                Corpus Extension • Snowballing & Supplementary
              </span>
              <h2 className="font-serif text-lg font-bold text-white tracking-wide">
                Add Paper Manually / via DOI
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-[#A09B8E] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          
          {/* Quick Auto-Fetch Input Strip */}
          <div className="bg-[#EFECE4] border border-[#DCD6C5] p-3 rounded space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-[#1A1917] text-xs flex items-center gap-1.5 uppercase">
                <Sparkles className="w-3.5 h-3.5 text-[#D94E28]" />
                <span>Auto-Fetch by DOI, ArXiv ID, or URL:</span>
              </label>
              <span className="text-[10px] text-[#7A766F]">
                CrossRef • OpenAlex • ArXiv • Web Scraper
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleFetchMetadata();
                    }
                  }}
                  placeholder="Paste 10.xxxx/... or https://arxiv.org/abs/... or publisher URL"
                  className="w-full bg-white border border-[#C8C1AE] px-3 py-2 pr-8 text-xs text-[#1A1917] placeholder-[#A09B8E] rounded focus:outline-none focus:border-[#D94E28]"
                />
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#7A766F] hover:text-[#1A1917] p-1"
                  title="Paste from clipboard"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleFetchMetadata()}
                disabled={isFetching}
                className="px-3.5 py-2 bg-[#1A1917] hover:bg-[#2C2B29] disabled:opacity-50 text-white text-xs font-bold rounded flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs cursor-pointer"
              >
                {isFetching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D94E28]" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
                )}
                <span>{isFetching ? 'Fetching...' : 'Fetch Metadata'}</span>
              </button>
            </div>

            {/* Success & Error notices */}
            {fetchSuccess && (
              <div className="text-[11px] text-[#2D7A53] bg-[#D4EBD9] border border-[#98D4A5] p-2 rounded flex items-center gap-1.5 font-bold animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{fetchSuccess}</span>
              </div>
            )}
            {fetchError && (
              <div className="text-[11px] text-[#C93B2B] bg-[#FADBD8] border border-[#F5B7B1] p-2 rounded flex items-center gap-1.5 font-bold animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{fetchError}</span>
              </div>
            )}
          </div>

          {/* Form Fields: Title */}
          <div>
            <label className="block text-[11px] font-bold text-[#1A1917] uppercase mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-[#4F46E5]" />
                <span>Paper Title *</span>
              </span>
              <span className="text-[#A09B8E] font-normal lowercase">required</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Prompt-based LLM Few-shot Evaluation for Vietnamese Scam Detection"
              className="w-full bg-white border border-[#C8C1AE] p-2 text-xs font-semibold text-[#1A1917] rounded focus:outline-none focus:border-[#D94E28]"
            />
          </div>

          {/* Form Fields: Authors */}
          <div>
            <label className="block text-[11px] font-bold text-[#1A1917] uppercase mb-1 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-[#2D7A53]" />
              <span>Authors (Comma separated)</span>
            </label>
            <input
              type="text"
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              placeholder="e.g. Nguyen Van A, Tran Thi B, Le Van C"
              className="w-full bg-white border border-[#C8C1AE] p-2 text-xs text-[#1A1917] rounded focus:outline-none focus:border-[#D94E28]"
            />
          </div>

          {/* 3-Column Grid: Year, Venue, Citations */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-[#1A1917] uppercase mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#D94E28]" />
                <span>Year</span>
              </label>
              <input
                type="number"
                min="1990"
                max="2030"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full bg-white border border-[#C8C1AE] p-2 text-xs text-[#1A1917] rounded focus:outline-none focus:border-[#D94E28]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-[#1A1917] uppercase mb-1 flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-[#6B46C1]" />
                <span>Venue / Journal / Conference</span>
              </label>
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. IEEE Access, ACL, arXiv, Elsevier"
                className="w-full bg-white border border-[#C8C1AE] p-2 text-xs text-[#1A1917] rounded focus:outline-none focus:border-[#D94E28]"
              />
            </div>
          </div>

          {/* 3-Column Grid: DOI, URL, Source */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-[#1A1917] uppercase mb-1 flex items-center gap-1">
                <Hash className="w-3 h-3 text-[#38BDF8]" />
                <span>DOI</span>
              </label>
              <input
                type="text"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                placeholder="10.xxxx/..."
                className="w-full bg-white border border-[#C8C1AE] p-2 text-xs text-[#1A1917] rounded focus:outline-none focus:border-[#D94E28]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#1A1917] uppercase mb-1 flex items-center gap-1">
                <LinkIcon className="w-3 h-3 text-[#2D7A53]" />
                <span>URL</span>
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-white border border-[#C8C1AE] p-2 text-xs text-[#1A1917] rounded focus:outline-none focus:border-[#D94E28]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#1A1917] uppercase mb-1 flex items-center gap-1">
                <Layers className="w-3 h-3 text-[#EA580C]" />
                <span>Source Provenance</span>
              </label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Manual Entry / CrossRef"
                className="w-full bg-white border border-[#C8C1AE] p-2 text-xs text-[#1A1917] rounded focus:outline-none focus:border-[#D94E28]"
              />
            </div>
          </div>

          {/* Abstract Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-[#1A1917] uppercase flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-[#D94E28]" />
                <span>Abstract</span>
              </label>
              <span className="text-[10px] text-[#7A766F]">
                {wordCount} words
              </span>
            </div>
            <textarea
              rows={4}
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              placeholder="Paste or review the paper abstract here..."
              className="w-full bg-white border border-[#C8C1AE] p-2 text-xs font-sans leading-relaxed text-[#1A1917] rounded focus:outline-none focus:border-[#D94E28]"
            />
          </div>

          {/* Initial Status Selector */}
          <div className="bg-[#EFECE4] p-2.5 rounded border border-[#DCD6C5] flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#1A1917] uppercase">
              Initial Screening Status:
            </span>
            <div className="flex items-center gap-3 text-xs font-bold">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="paperStatus"
                  value="PENDING"
                  checked={status === 'PENDING'}
                  onChange={() => setStatus('PENDING')}
                  className="accent-[#D94E28]"
                />
                <span className="text-[#4A4843]">Pending Screening</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="paperStatus"
                  value="INCLUDED"
                  checked={status === 'INCLUDED'}
                  onChange={() => setStatus('INCLUDED')}
                  className="accent-[#2D7A53]"
                />
                <span className="text-[#2D7A53]">Directly Included</span>
              </label>
            </div>
          </div>

        </form>

        {/* Footer Actions */}
        <div className="bg-[#EDE9DF] border-t border-[#DCD6C5] px-6 py-3 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleResetForm}
            className="px-3 py-1.5 bg-[#E5E0D3] hover:bg-[#DDD7C8] text-[#4A4843] text-xs font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Form</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-[#E5E0D3] hover:bg-[#DDD7C8] text-[#4A4843] text-xs font-bold rounded transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving || !title.trim()}
              className="px-5 py-1.5 bg-[#2D7A53] hover:bg-[#236142] disabled:opacity-50 text-white text-xs font-bold rounded flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>{isSaving ? 'Saving...' : 'Add to Corpus'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
