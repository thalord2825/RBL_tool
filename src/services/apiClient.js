import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 0, // Zero timeout to prevent premature aborts on large batch operations
});

export const apiClient = {
  // Health
  checkHealth: async () => {
    const res = await axios.get('http://127.0.0.1:8000/');
    return res.data;
  },

  // Get all papers
  getPapers: async (projectId = 'default') => {
    const res = await api.get('/papers', { params: { project_id: projectId } });
    return res.data;
  },

  // Search across academic APIs (Synchronous fallback)
  searchPapers: async ({ query, sources, sinceYear, limitPerSource = 25, projectId = 'default' }) => {
    const res = await api.post('/search', {
      query,
      sources,
      since_year: parseInt(sinceYear, 10),
      limit_per_source: limitPerSource,
      project_id: projectId,
    });
    return res.data;
  },

  // Real-Time Streaming Search & Harvest (SSE Stream)
  streamHarvestPapers: async ({ query, sources, sinceYear, limitPerSource = 25, projectId = 'default', onEvent, onError }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/stream/harvest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          sources,
          since_year: parseInt(sinceYear, 10),
          limit_per_source: limitPerSource,
          project_id: projectId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep remaining incomplete chunk in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            try {
              const jsonStr = trimmed.replace(/^data:\s*/, '');
              const eventData = JSON.parse(jsonStr);
              if (onEvent) onEvent(eventData);
            } catch (e) {
              console.warn('Failed to parse SSE harvest chunk:', e);
            }
          }
        }
      }
    } catch (err) {
      if (onError) onError(err);
      else throw err;
    }
  },

  // Real-Time Streaming AI Auto-Screen with Micro-Batches (SSE Stream)
  streamAiScreenPapers: async ({ apiKey, modelName = 'auto', researchQuestion, pico, icList, ecList, paperIds, projectId = 'default', onEvent, onError }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/stream/ai-screen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          model_name: modelName,
          research_question: researchQuestion,
          pico,
          ic_list: icList,
          ec_list: ecList,
          paper_ids: paperIds,
          project_id: projectId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            try {
              const jsonStr = trimmed.replace(/^data:\s*/, '');
              const eventData = JSON.parse(jsonStr);
              if (onEvent) onEvent(eventData);
            } catch (e) {
              console.warn('Failed to parse SSE AI screening chunk:', e);
            }
          }
        }
      }
    } catch (err) {
      if (onError) onError(err);
      else throw err;
    }
  },

  // Synchronous batch screening fallback
  aiScreenPapers: async ({ apiKey, modelName = 'auto', researchQuestion, pico, icList, ecList, paperIds, projectId = 'default' }) => {
    const res = await api.post('/ai-screen', {
      api_key: apiKey,
      model_name: modelName,
      research_question: researchQuestion,
      pico,
      ic_list: icList,
      ec_list: ecList,
      paper_ids: paperIds,
      project_id: projectId,
    });
    return res.data;
  },

  // Merge duplicates side-by-side
  mergeDuplicates: async ({ keepId, removeId }) => {
    const res = await api.post('/papers/merge-duplicates', {
      keep_id: keepId,
      remove_id: removeId,
    });
    return res.data;
  },

  // Re-scan duplicate author overlap flags
  checkDuplicates: async (projectId = 'default') => {
    const res = await api.post('/papers/check-duplicates', null, { params: { project_id: projectId } });
    return res.data;
  },

  // Update paper metadata, status, or empirical extraction
  updatePaper: async (paperId, updates) => {
    const res = await api.put(`/papers/${paperId}`, updates);
    return res.data;
  },

  // Bulk update multiple papers at once
  bulkUpdatePapers: async ({ paperIds, updates, projectId = 'default' }) => {
    const res = await api.post('/papers/bulk-update', {
      paper_ids: paperIds,
      updates,
      project_id: projectId,
    });
    return res.data;
  },

  // Delete paper
  deletePaper: async (paperId) => {
    const res = await api.delete(`/papers/${paperId}`);
    return res.data;
  },

  // Bulk delete multiple papers at once
  bulkDeletePapers: async ({ paperIds, projectId = 'default' }) => {
    const res = await api.post('/papers/bulk-delete', {
      paper_ids: paperIds,
      project_id: projectId,
    });
    return res.data;
  },

  // Clear all papers for project
  clearPapers: async (projectId = 'default') => {
    const res = await api.delete('/papers', { params: { project_id: projectId } });
    return res.data;
  },

  // Generate 6 RBL files
  exportFiles: async ({ authorName, searchQuery, sources, projectId = 'default' }) => {
    const res = await api.post('/export', {
      author_name: authorName,
      search_query: searchQuery,
      sources,
      project_id: projectId,
    });
    return res.data;
  },

  // 1-Click Single Atomic Commit to GitHub
  commitToGithub: async ({
    repoOwner,
    repoName,
    branch,
    memberPath,
    commitPrefix,
    githubToken,
    authorName,
    searchQuery,
    sources,
    projectId = 'default',
  }) => {
    const res = await api.post('/git-commit', {
      repo_owner: repoOwner,
      repo_name: repoName,
      branch,
      member_path: memberPath,
      commit_prefix: commitPrefix,
      github_token: githubToken,
      author_name: authorName,
      search_query: searchQuery,
      sources,
      project_id: projectId,
    });
    return res.data;
  },

  // Protocol (PICO + IC/EC) CRUD
  getProtocol: async (projectId = 'default') => {
    const res = await api.get('/protocol', { params: { project_id: projectId } });
    return res.data;
  },

  saveProtocol: async ({ projectId = 'default', pico, icList, ecList }) => {
    const res = await api.put('/protocol', {
      project_id: projectId,
      pico,
      ic_list: icList,
      ec_list: ecList,
    });
    return res.data;
  },
};
