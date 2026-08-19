import React, { useState } from 'react';
import { X, GitCommit, Save, Key, Folder, GitBranch, Eye, EyeOff, User } from 'lucide-react';

export default function GitCommitSettingsModal({ isOpen, onClose, gitSettings, onSaveGitSettings }) {
  const [formData, setFormData] = useState(gitSettings || {
    repoOwner: 'QuangWorkIT',
    repoName: 'RBL_ScamShield',
    branch: 'main',
    memberPath: 'trung_hieu/SLR/',
    commitPrefix: '[SLR]',
    authorName: 'Nguyen Trung Hieu',
    githubToken: ''
  });

  const [showToken, setShowToken] = useState(false);

  if (!isOpen) return null;

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveGitSettings(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none">
      <div className="bg-[#F4F1EA] border-2 border-[#1A1917] max-w-xl w-full shadow-[8px_8px_0px_0px_rgba(26,25,23,0.8)] overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#EDE9DF] px-6 py-3 border-b border-[#DCD6C5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCommit className="w-5 h-5 text-[#D94E28]" />
            <div>
              <div className="font-mono text-[10px] text-[#7A766F] uppercase tracking-widest font-bold">
                Git Trees Database Engine
              </div>
              <h2 className="font-serif text-xl font-bold text-[#1A1917]">
                GitHub Sync Configuration
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 font-mono text-xs">
          
          {/* Researcher Author Name */}
          <div>
            <label className="block text-[11px] font-bold text-[#1A1917] mb-1 uppercase flex items-center gap-1">
              <User className="w-3 h-3 text-[#2D7A53]" />
              Researcher Full Name (LR)
            </label>
            <input
              type="text"
              value={formData.authorName}
              onChange={(e) => handleChange('authorName', e.target.value)}
              className="w-full bg-[#F8F6F0] border border-[#C8C1AE] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28]"
              placeholder="Nguyen Trung Hieu"
            />
          </div>

          {/* Target Repo Owner & Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-[#1A1917] mb-1 uppercase">
                GitHub Owner / Org
              </label>
              <input
                type="text"
                value={formData.repoOwner}
                onChange={(e) => handleChange('repoOwner', e.target.value)}
                className="w-full bg-[#F8F6F0] border border-[#C8C1AE] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28]"
                placeholder="QuangWorkIT"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#1A1917] mb-1 uppercase">
                Repository Name
              </label>
              <input
                type="text"
                value={formData.repoName}
                onChange={(e) => handleChange('repoName', e.target.value)}
                className="w-full bg-[#F8F6F0] border border-[#C8C1AE] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28]"
                placeholder="RBL_ScamShield"
              />
            </div>
          </div>

          {/* Branch & Commit Prefix */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-[#1A1917] mb-1 uppercase flex items-center gap-1">
                <GitBranch className="w-3 h-3 text-[#2D7A53]" />
                Branch Name
              </label>
              <input
                type="text"
                value={formData.branch}
                onChange={(e) => handleChange('branch', e.target.value)}
                className="w-full bg-[#F8F6F0] border border-[#C8C1AE] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28]"
                placeholder="main"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#1A1917] mb-1 uppercase">
                Commit Message Prefix
              </label>
              <input
                type="text"
                value={formData.commitPrefix}
                onChange={(e) => handleChange('commitPrefix', e.target.value)}
                className="w-full bg-[#F8F6F0] border border-[#C8C1AE] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28]"
                placeholder="[SLR]"
              />
            </div>
          </div>

          {/* Target Folder Path */}
          <div>
            <label className="block text-[11px] font-bold text-[#1A1917] mb-1 uppercase flex items-center gap-1">
              <Folder className="w-3 h-3 text-[#D94E28]" />
              Target Folder Path (Member Directory)
            </label>
            <input
              type="text"
              value={formData.memberPath}
              onChange={(e) => handleChange('memberPath', e.target.value)}
              className="w-full bg-[#F8F6F0] border border-[#C8C1AE] p-2 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28]"
              placeholder="trung_hieu/SLR/"
            />
            <p className="text-[10px] text-[#7A766F] mt-1">
              Target path: <code className="text-[#D94E28]">{formData.repoOwner}/{formData.repoName}/{formData.branch}/{formData.memberPath}</code>
            </p>
          </div>

          {/* GitHub Personal Access Token */}
          <div>
            <label className="block text-[11px] font-bold text-[#1A1917] mb-1 uppercase flex items-center gap-1">
              <Key className="w-3 h-3 text-[#B8860B]" />
              GitHub Personal Access Token (PAT)
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={formData.githubToken}
                onChange={(e) => handleChange('githubToken', e.target.value)}
                className="w-full bg-[#F8F6F0] border border-[#C8C1AE] p-2 pr-8 text-xs text-[#1A1917] focus:outline-none focus:border-[#D94E28]"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-2 text-[#7A766F] hover:text-[#1A1917]"
              >
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
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
              className="btn-editorial bg-[#D94E28] hover:bg-[#C4411C] py-2.5 px-6 font-bold flex items-center gap-2 text-white"
            >
              <Save className="w-4 h-4" />
              <span>Save Git Config</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
