/**
 * OpenAlex API Scraper Service
 * Fetches research papers from https://api.openalex.org/works
 */
export async function searchOpenAlex(query, maxResults = 25, startYear = 2020) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.openalex.org/works?search=${encodedQuery}&filter=from_publication_date:${startYear}-01-01&per_page=${maxResults}&sort=publication_year:desc`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OpenAlex API HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const results = data.results || [];

    const papers = results.map(item => {
      const year = item.publication_year || new Date().getFullYear();
      const title = item.title || 'Untitled Work';
      const doi = item.doi ? item.doi.replace('https://doi.org/', '') : `N/A`;
      
      const authorsList = (item.authorships || [])
        .map(a => a.author ? a.author.display_name : '')
        .filter(Boolean)
        .slice(0, 5);

      const venue = item.primary_location?.source?.display_name || 'OpenAlex Index';
      const landingUrl = item.primary_location?.landing_page_url || item.doi || item.id;

      // Reconstruct abstract from inverted index if present
      let abstract = 'Abstract omitted or unavailable.';
      if (item.abstract_inverted_index) {
        const words = [];
        Object.entries(item.abstract_inverted_index).forEach(([word, positions]) => {
          positions.forEach(pos => {
            words[pos] = word;
          });
        });
        abstract = words.join(' ');
      }

      return {
        id: `oa_${item.id.split('/').pop()}`,
        title,
        year,
        authors: authorsList.join(', ') || 'Unknown Authors',
        venue,
        doi,
        url: landingUrl,
        abstract,
        source: 'OpenAlex',
        status: 'PENDING',
        studyType: 'Empirical',
        keyContribution: abstract.length > 200 ? abstract.substring(0, 197) + '...' : abstract,
        notReported: ['stat_test'],
        hypothesisTag: '✓ supports H1'
      };
    });

    return papers;
  } catch (error) {
    console.error('Failed to fetch from OpenAlex:', error);
    return [];
  }
}
