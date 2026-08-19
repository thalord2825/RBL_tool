/**
 * ArXiv API Scraper Service
 * Fetches real research papers from http://export.arxiv.org/api/query
 */
export async function searchArxiv(query, maxResults = 25, startYear = 2020) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodedQuery}&start=0&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ArXiv API HTTP error! status: ${response.status}`);
    }
    
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    const entries = xmlDoc.getElementsByTagName('entry');
    const papers = [];
    
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const title = entry.getElementsByTagName('title')[0]?.textContent?.trim() || 'Untitled';
      const published = entry.getElementsByTagName('published')[0]?.textContent || '';
      const year = published ? parseInt(published.substring(0, 4), 10) : new Date().getFullYear();
      
      if (year < startYear) continue;

      const summary = entry.getElementsByTagName('summary')[0]?.textContent?.trim() || '';
      
      const authorNodes = entry.getElementsByTagName('author');
      const authors = [];
      for (let j = 0; j < authorNodes.length; j++) {
        const nameNode = authorNodes[j].getElementsByTagName('name')[0];
        if (nameNode) authors.push(nameNode.textContent.trim());
      }

      const idNode = entry.getElementsByTagName('id')[0]?.textContent || '';
      const arxivId = idNode.split('/abs/')[1] || idNode;
      const pdfUrl = idNode.replace('/abs/', '/pdf/') + '.pdf';
      const doiNode = entry.getElementsByTagName('arxiv:doi')[0];
      const doi = doiNode ? doiNode.textContent.trim() : `10.48550/arXiv.${arxivId}`;

      papers.push({
        id: `arxiv_${arxivId.replace(/[^a-zA-Z0-9]/g, '_')}`,
        title: title.replace(/\n/g, ' '),
        year,
        authors: authors.join(', ') || 'Unknown Authors',
        venue: 'arXiv preprint',
        doi,
        url: idNode || `https://arxiv.org/abs/${arxivId}`,
        pdfUrl,
        abstract: summary.replace(/\n/g, ' '),
        source: 'ArXiv',
        status: 'PENDING',
        studyType: 'Empirical',
        keyContribution: summary.length > 200 ? summary.substring(0, 197) + '...' : summary,
        notReported: ['stat_test'],
        hypothesisTag: '✓ supports H1'
      });
    }

    return papers;
  } catch (error) {
    console.error('Failed to fetch from ArXiv:', error);
    return [];
  }
}
