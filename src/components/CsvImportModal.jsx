import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  ArrowRight, 
  Check, 
  RefreshCw, 
  Loader2,
  FileText,
  Sliders,
  Database
} from 'lucide-react';
import apiClient from '../services/apiClient';

// Helper function to auto-detect delimiter and parse CSV lines with quoted multiline support
function parseCsvContent(text) {
  if (!text || !text.trim()) return { headers: [], rows: [] };

  // Detect delimiter: comma, semicolon, tab
  const firstLine = text.split(/\r\n|\n|\r/)[0] || '';
  let delimiter = ',';
  if ((firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length) {
    delimiter = ';';
  } else if ((firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length) {
    delimiter = '\t';
  }

  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      if (currentRow.some(cell => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(cell => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) return { headers: [], rows: [] };

  const rawHeaders = rows[0].map(h => h.replace(/^["']|["']$/g, '').trim());
  const dataRows = rows.slice(1);

  return { headers: rawHeaders, rows: dataRows, delimiter };
}

// Canonical target fields
const CANONICAL_FIELDS = [
  { key: 'title', label: 'Paper Title (Required)', required: true, aliases: ['title', 'paper title', 'document title', 'article title', 'name', 'item title', 'ti'] },
  { key: 'authors', label: 'Authors', required: false, aliases: ['authors', 'author', 'author(s)', 'creators', 'author names', 'authors names', 'au', 'creator'] },
  { key: 'year', label: 'Publication Year', required: false, aliases: ['year', 'publication year', 'pub year', 'date', 'year published', 'py', 'issued'] },
  { key: 'venue', label: 'Venue / Journal / Conference', required: false, aliases: ['venue', 'journal', 'publication title', 'booktitle', 'conference', 'source title', 'publisher', 'so', 'journal title'] },
  { key: 'abstract', label: 'Abstract', required: false, aliases: ['abstract', 'abstract note', 'description', 'summary', 'ab'] },
  { key: 'doi', label: 'DOI', required: false, aliases: ['doi', 'digital object identifier', 'document identifier', 'article doi'] },
  { key: 'url', label: 'URL / Document Link', required: false, aliases: ['url', 'link', 'link to document', 'pdf link', 'web page', 'uri'] },
  { key: 'citations_count', label: 'Citations Count', required: false, aliases: ['citations', 'cited by', 'tc', 'total citations', 'citation count', 'times cited'] }
];

// Fuzzy match header name to canonical field
function findBestFieldMatch(headerName) {
  const norm = headerName.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const field of CANONICAL_FIELDS) {
    for (const alias of field.aliases) {
      const normAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (norm === normAlias || norm.includes(normAlias) || normAlias.includes(norm)) {
        return field.key;
      }
    }
  }
  return '';
}

export default function CsvImportModal({
  isOpen,
  onClose,
  onImportSuccess
}) {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState({ headers: [], rows: [] });
  const [columnMapping, setColumnMapping] = useState({});
  const [sourceLabel, setSourceLabel] = useState('CSV Import');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (uploadedFile) => {
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const { headers, rows } = parseCsvContent(content);
      setParsedData({ headers, rows });

      // Automatically construct initial mapping based on fuzzy matches
      const initialMap = {};
      CANONICAL_FIELDS.forEach(field => {
        initialMap[field.key] = '';
      });

      headers.forEach(header => {
        const bestMatch = findBestFieldMatch(header);
        if (bestMatch && !initialMap[bestMatch]) {
          initialMap[bestMatch] = header;
        }
      });

      setColumnMapping(initialMap);
    };
    reader.readAsText(uploadedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleMappingChange = (fieldKey, headerValue) => {
    setColumnMapping(prev => ({
      ...prev,
      [fieldKey]: headerValue
    }));
  };

  // Convert raw parsed rows into canonical paper objects
  const getMappedPapers = () => {
    const { headers, rows } = parsedData;
    if (rows.length === 0 || !columnMapping.title) return [];

    const getHeaderIndex = (fieldKey) => {
      const headerName = columnMapping[fieldKey];
      return headerName ? headers.indexOf(headerName) : -1;
    };

    const titleIdx = getHeaderIndex('title');
    const authorsIdx = getHeaderIndex('authors');
    const yearIdx = getHeaderIndex('year');
    const venueIdx = getHeaderIndex('venue');
    const abstractIdx = getHeaderIndex('abstract');
    const doiIdx = getHeaderIndex('doi');
    const urlIdx = getHeaderIndex('url');
    const citationsIdx = getHeaderIndex('citations_count');

    return rows.map((row) => {
      const rawTitle = titleIdx >= 0 ? row[titleIdx] : '';
      if (!rawTitle || !rawTitle.trim()) return null;

      const rawYearStr = yearIdx >= 0 ? row[yearIdx] : '';
      const yearNum = parseInt(rawYearStr?.replace(/[^0-9]/g, ''), 10);

      const rawCitations = citationsIdx >= 0 ? row[citationsIdx] : '0';
      const citationsNum = parseInt(rawCitations?.replace(/[^0-9]/g, ''), 10) || 0;

      return {
        title: rawTitle.trim(),
        authors: authorsIdx >= 0 && row[authorsIdx] ? row[authorsIdx].trim() : 'N/A',
        year: !isNaN(yearNum) && yearNum > 1900 && yearNum < 2100 ? yearNum : null,
        venue: venueIdx >= 0 && row[venueIdx] ? row[venueIdx].trim() : 'N/A',
        abstract: abstractIdx >= 0 && row[abstractIdx] ? row[abstractIdx].trim() : '',
        doi: doiIdx >= 0 && row[doiIdx] ? row[doiIdx].replace(/https?:\/\/(dx\.)?doi\.org\//i, '').trim() : null,
        url: urlIdx >= 0 && row[urlIdx] ? row[urlIdx].trim() : null,
        source: sourceLabel.trim() || 'CSV Import',
        citations_count: citationsNum
      };
    }).filter(Boolean);
  };

  const mappedPapers = getMappedPapers();
  const previewRows = mappedPapers.slice(0, 5);

  const handleExecuteImport = async () => {
    if (mappedPapers.length === 0) {
      alert('Please map the Title column and ensure the CSV contains valid paper rows.');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await apiClient.importCsvPapers({
        papers: mappedPapers,
        sourceLabel: sourceLabel.trim() || 'CSV Import',
        projectId: 'default'
      });

      setImportResult({
        importedCount: res.imported_count || mappedPapers.length,
        newAdded: res.new_added,
        duplicatesFiltered: res.duplicates_filtered,
        totalCorpus: res.total_corpus
      });

      if (onImportSuccess) {
        onImportSuccess(res);
      }
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedData({ headers: [], rows: [] });
    setColumnMapping({});
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#F4F1EA] border-2 border-[#1A1917] max-w-4xl w-full shadow-[8px_8px_0px_0px_rgba(26,25,23,0.85)] overflow-hidden my-6 font-mono flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#1A1917] text-[#F4F1EA] px-6 py-3.5 border-b-2 border-[#1A1917] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-[#38BDF8]" />
            <div>
              <div className="font-mono text-[10px] text-[#A09B8E] uppercase tracking-widest font-bold">
                Literature Corpus Ingestion Pipeline
              </div>
              <h2 className="font-serif text-lg font-bold text-white tracking-wide">
                Import Academic Literature from CSV / BibTeX
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
        <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-[#F4F1EA] text-xs">
          
          {/* SUCCESS RESULT SCREEN */}
          {importResult ? (
            <div className="bg-[#F8F6F0] border-2 border-[#2D7A53] p-6 space-y-4 rounded text-center animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 bg-[#D4EBD9] text-[#2D7A53] rounded-full flex items-center justify-center mx-auto border-2 border-[#98D4A5]">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div>
                <h3 className="font-serif text-xl font-bold text-[#1A1917]">
                  CSV Ingestion Completed Successfully!
                </h3>
                <p className="text-xs text-[#55524B] mt-1 font-sans">
                  The imported literature has been automatically processed, deduplicated, and persisted into SQLite.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto py-2">
                <div className="bg-[#EDE9DF] p-3 rounded border border-[#DCD6C5]">
                  <div className="text-[10px] text-[#7A766F] uppercase font-bold">Total Imported</div>
                  <div className="font-bold text-lg text-[#1A1917]">{importResult.importedCount}</div>
                </div>
                <div className="bg-[#D4EBD9] p-3 rounded border border-[#98D4A5]">
                  <div className="text-[10px] text-[#2D7A53] uppercase font-bold">+ New Unique Added</div>
                  <div className="font-bold text-lg text-[#2D7A53]">{importResult.newAdded}</div>
                </div>
                <div className="bg-[#FEF3C7] p-3 rounded border border-[#FDE68A]">
                  <div className="text-[10px] text-[#92400E] uppercase font-bold">Duplicates Filtered</div>
                  <div className="font-bold text-lg text-[#92400E]">{importResult.duplicatesFiltered}</div>
                </div>
              </div>

              <div className="pt-2 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 bg-[#EDE9DF] hover:bg-[#DCD6C5] text-[#1A1917] font-bold rounded border border-[#C8C1AE]"
                >
                  Import Another CSV
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 bg-[#D94E28] hover:bg-[#C4411C] text-white font-bold rounded shadow-xs"
                >
                  Return to Evidence Table
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* STAGE 1: FILE DROPZONE */}
              {!file ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-[#D94E28] bg-[#FFF9EB]'
                      : 'border-[#C8C1AE] bg-[#F8F6F0] hover:bg-[#EDE9DF] hover:border-[#1A1917]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.tsv,.txt"
                    onChange={(e) => handleFileChange(e.target.files?.[0])}
                    className="hidden"
                  />
                  <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-[#D94E28]' : 'text-[#7A766F]'}`} />
                  <h3 className="font-serif text-base font-bold text-[#1A1917]">
                    Click to browse or Drag & Drop your CSV file here
                  </h3>
                  <p className="text-[11px] text-[#7A766F] font-sans mt-1">
                    Supports exports from Scopus, Web of Science, ACM Digital Library, IEEE Xplore, Rayyan, or custom CSVs (.csv, .tsv, .txt)
                  </p>
                </div>
              ) : (
                <div className="bg-[#EFECE4] border border-[#DCD6C5] p-3.5 rounded flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-[#D94E28]" />
                    <div>
                      <div className="font-bold text-xs text-[#1A1917]">{file.name}</div>
                      <div className="text-[10px] text-[#7A766F]">
                        {(file.size / 1024).toFixed(1)} KB • {parsedData.rows.length} total data rows detected • {parsedData.headers.length} columns
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-2.5 py-1 text-[11px] bg-[#EDE9DF] hover:bg-[#DCD6C5] text-[#C93B2B] border border-[#C8C1AE] rounded font-bold"
                  >
                    Change File
                  </button>
                </div>
              )}

              {/* STAGE 2: COLUMN MAPPING & CONFIGURATION */}
              {file && parsedData.headers.length > 0 && (
                <div className="space-y-4 pt-1">
                  <div className="flex items-center justify-between border-b border-[#DCD6C5] pb-2">
                    <div className="font-bold text-xs text-[#1A1917] uppercase flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-[#D94E28]" />
                      <span>Schema Field Mapping ({mappedPapers.length} valid papers ready)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#7A766F]">Source Tag:</span>
                      <input
                        type="text"
                        value={sourceLabel}
                        onChange={(e) => setSourceLabel(e.target.value)}
                        placeholder="e.g. Scopus, IEEE, CSV Import"
                        className="bg-white border border-[#C8C1AE] px-2 py-0.5 text-xs text-[#1A1917] font-mono rounded w-36 focus:outline-none focus:border-[#D94E28]"
                      />
                    </div>
                  </div>

                  {/* Mapping Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {CANONICAL_FIELDS.map(field => {
                      const selectedHeader = columnMapping[field.key] || '';
                      const isMapped = !!selectedHeader;

                      return (
                        <div 
                          key={field.key} 
                          className={`p-2.5 rounded border transition-colors ${
                            field.required && !isMapped 
                              ? 'bg-[#FDF2F2] border-[#F5B7B1]' 
                              : isMapped 
                              ? 'bg-[#F8F6F0] border-[#DCD6C5]' 
                              : 'bg-[#EDE9DF]/50 border-dashed border-[#DCD6C5]'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                            <span className={field.required ? 'text-[#C93B2B]' : 'text-[#4A4843]'}>
                              {field.label}
                            </span>
                            {isMapped && <Check className="w-3 h-3 text-[#2D7A53]" />}
                          </div>

                          <select
                            value={selectedHeader}
                            onChange={(e) => handleMappingChange(field.key, e.target.value)}
                            className={`w-full p-1.5 text-[11px] font-mono border rounded focus:outline-none ${
                              field.required && !isMapped
                                ? 'border-[#C93B2B] bg-white text-[#C93B2B]'
                                : 'border-[#C8C1AE] bg-white text-[#1A1917] focus:border-[#D94E28]'
                            }`}
                          >
                            <option value="">-- Unmapped / Skip --</option>
                            {parsedData.headers.map((h, i) => (
                              <option key={i} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>

                  {/* STAGE 3: INTERACTIVE PREVIEW MATRIX (FIRST 5 ROWS) */}
                  {previewRows.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <div className="text-[11px] font-bold text-[#1A1917] uppercase flex items-center justify-between">
                        <span>Pre-Import Data Preview (First 5 Rows):</span>
                        <span className="text-[#7A766F] font-normal text-[10px]">
                          Automated deduplication will run on all {mappedPapers.length} records
                        </span>
                      </div>

                      <div className="overflow-x-auto border border-[#DCD6C5] rounded max-h-48 bg-white">
                        <table className="w-full text-left font-sans text-[11px] table-fixed">
                          <thead className="bg-[#EDE9DF] border-b border-[#DCD6C5] font-mono text-[10px] text-[#4A4843] uppercase sticky top-0">
                            <tr>
                              <th className="p-2 w-12 text-center">#</th>
                              <th className="p-2 min-w-[200px]">Title</th>
                              <th className="p-2 w-36">Authors</th>
                              <th className="p-2 w-16 text-center">Year</th>
                              <th className="p-2 w-32">Venue</th>
                              <th className="p-2 w-28">DOI</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E5E0D3]">
                            {previewRows.map((paper, idx) => (
                              <tr key={idx} className="hover:bg-[#FAF8F5]">
                                <td className="p-2 font-mono text-center text-[#7A766F]">{idx + 1}</td>
                                <td className="p-2 font-serif font-semibold text-[#1A1917] truncate" title={paper.title}>
                                  {paper.title}
                                </td>
                                <td className="p-2 text-[#55524B] truncate" title={paper.authors}>
                                  {paper.authors}
                                </td>
                                <td className="p-2 font-mono text-center">{paper.year || '—'}</td>
                                <td className="p-2 text-[#55524B] truncate" title={paper.venue}>{paper.venue}</td>
                                <td className="p-2 font-mono text-[10px] text-[#7A766F] truncate">{paper.doi || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </>
          )}

        </div>

        {/* Footer Actions */}
        {!importResult && (
          <div className="bg-[#EDE9DF] px-6 py-3.5 border-t border-[#DCD6C5] flex items-center justify-between shrink-0">
            <div className="text-[11px] text-[#7A766F] font-mono">
              {mappedPapers.length > 0 ? (
                <span>Ready to ingest: <strong className="text-[#D94E28] font-bold">{mappedPapers.length} papers</strong></span>
              ) : (
                <span>Upload a CSV to begin</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-[#EFECE4] hover:bg-[#DCD6C5] text-[#1A1917] font-bold rounded border border-[#C8C1AE] transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isProcessing || mappedPapers.length === 0}
                onClick={handleExecuteImport}
                className="bg-[#D94E28] hover:bg-[#C4411C] py-2 px-5 font-bold flex items-center gap-2 text-white rounded transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deduplicating & Ingesting...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    <span>Import {mappedPapers.length} Papers</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
