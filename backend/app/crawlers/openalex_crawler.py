import logging
from typing import List, Dict, Any, Optional
from .base import BaseAPIClient

logger = logging.getLogger(__name__)

class OpenAlexCrawler(BaseAPIClient):
    def __init__(self, polite_email: str = "rbl.researcher@university.edu"):
        super().__init__(
            base_url="https://api.openalex.org",
            rate_limit_per_second=5.0,  # OpenAlex allows up to 10 req/s in polite pool
            timeout=20,
            max_retries=3,
            api_type="openalex"
        )
        self.polite_email = polite_email

    def _reconstruct_abstract(self, inverted_index: Optional[Dict[str, List[int]]]) -> str:
        if not inverted_index:
            return "N/A"
        try:
            position_word_map = {}
            for word, positions in inverted_index.items():
                for pos in positions:
                    position_word_map[pos] = word
            
            if not position_word_map:
                return "N/A"

            max_pos = max(position_word_map.keys())
            words = [position_word_map.get(i, "") for i in range(max_pos + 1)]
            return " ".join(filter(bool, words))
        except Exception as e:
            logger.warning(f"Failed to reconstruct OpenAlex abstract: {e}")
            return "N/A"

    def search(self, query: str, limit: int = 25, start_year: int = 2020, since_year: Optional[int] = None, **kwargs) -> List[Dict[str, Any]]:
        effective_year = since_year if since_year is not None else start_year
        # OpenAlex search parameter with year filter
        params = {
            "search": query,
            "filter": f"from_publication_date:{effective_year}-01-01",
            "per_page": min(limit, 100),
            "sort": "publication_year:desc",
            "select": "id,doi,title,authorships,publication_year,primary_location,cited_by_count,abstract_inverted_index"
        }
        
        headers = {
            "User-Agent": f"RBL-ResearchTool/2.0 (mailto:{self.polite_email})"
        }

        try:
            response = self._make_request("GET", "works", params=params, headers=headers)
            data = response.json()
            results = data.get("results", [])

            papers = []
            for item in results:
                try:
                    title = item.get("title") or "Untitled"
                    year = item.get("publication_year") or 2024
                    
                    if year < start_year:
                        continue

                    # Authors
                    authors_list = []
                    for auth in item.get("authorships", []):
                        author_obj = auth.get("author", {})
                        name = author_obj.get("display_name")
                        if name:
                            authors_list.append(name)
                    authors = ", ".join(authors_list) if authors_list else "Unknown Authors"

                    # DOI & URL
                    raw_doi = item.get("doi") or ""
                    doi = raw_doi.replace("https://doi.org/", "").strip() if raw_doi else "N/A"
                    url = raw_doi if raw_doi else item.get("id", "")

                    # Venue / Publisher
                    primary_loc = item.get("primary_location") or {}
                    source_obj = primary_loc.get("source") or {}
                    venue = source_obj.get("display_name") or "OpenAlex Index"

                    # Abstract
                    abstract = self._reconstruct_abstract(item.get("abstract_inverted_index"))
                    
                    # Citations
                    citations_count = item.get("cited_by_count", 0)

                    papers.append({
                        "title": title,
                        "authors": authors,
                        "year": year,
                        "venue": venue,
                        "abstract": abstract,
                        "doi": doi,
                        "url": url,
                        "source": "OpenAlex",
                        "citations_count": citations_count
                    })
                except Exception as e:
                    logger.warning(f"Error parsing OpenAlex work: {e}")
                    continue

            return papers
        except Exception as e:
            logger.error(f"OpenAlex query failed: {e}")
            return []
