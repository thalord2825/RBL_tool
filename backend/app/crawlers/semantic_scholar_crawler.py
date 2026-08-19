import logging
from typing import List, Dict, Any, Optional
from .base import BaseAPIClient

logger = logging.getLogger(__name__)

class SemanticScholarCrawler(BaseAPIClient):
    def __init__(self, api_key: Optional[str] = None):
        super().__init__(
            base_url="https://api.semanticscholar.org/graph/v1",
            api_key=api_key,
            rate_limit_per_second=2.0 if api_key else 0.5,
            timeout=8,
            max_retries=1,
            api_type="semantic_scholar"
        )

    def search(self, query: str, limit: int = 25, start_year: int = 2020, since_year: Optional[int] = None, **kwargs) -> List[Dict[str, Any]]:
        effective_year = since_year if since_year is not None else start_year
        params = {
            "query": query,
            "limit": min(limit, 30),
            "year": f"{effective_year}-",
            "fields": "title,authors,year,venue,externalIds,url,citationCount,abstract"
        }

        headers = {}
        if self.api_key:
            headers["x-api-key"] = self.api_key

        try:
            response = self._make_request("GET", "paper/search", params=params, headers=headers)
            data = response.json()
            items = data.get("data", [])

            papers = []
            for item in items:
                try:
                    title = item.get("title") or "Untitled"
                    year = item.get("year") or 2024
                    
                    if year < start_year:
                        continue

                    # Authors
                    authors_list = [a.get("name", "") for a in item.get("authors", []) if a.get("name")]
                    authors = ", ".join(authors_list) if authors_list else "Unknown Authors"

                    # DOI & URL
                    ext_ids = item.get("externalIds") or {}
                    doi = ext_ids.get("DOI") or "N/A"
                    url = item.get("url") or (f"https://doi.org/{doi}" if doi != "N/A" else "")

                    venue = item.get("venue") or "Semantic Scholar Index"
                    abstract = item.get("abstract") or "N/A"
                    citations_count = item.get("citationCount") or 0

                    papers.append({
                        "title": title,
                        "authors": authors,
                        "year": year,
                        "venue": venue,
                        "abstract": abstract,
                        "doi": doi,
                        "url": url,
                        "source": "Semantic Scholar",
                        "citations_count": citations_count
                    })
                except Exception as e:
                    continue

            return papers
        except Exception as e:
            logger.warning(f"Semantic Scholar query gracefully skipped: {e}")
            return []
