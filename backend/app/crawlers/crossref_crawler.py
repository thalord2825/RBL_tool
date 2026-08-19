import logging
import re
from typing import List, Dict, Any
from .base import BaseAPIClient

logger = logging.getLogger(__name__)

class CrossrefCrawler(BaseAPIClient):
    def __init__(self):
        super().__init__(
            base_url="https://api.crossref.org",
            rate_limit_per_second=5.0,
            timeout=20,
            max_retries=3,
            api_type="crossref"
        )

    def search(self, query: str, limit: int = 25, start_year: int = 2020, since_year: Optional[int] = None, **kwargs) -> List[Dict[str, Any]]:
        effective_year = since_year if since_year is not None else start_year
        params = {
            "query": query,
            "rows": min(limit, 50),
            "sort": "relevance",
            "select": "DOI,title,author,published,container-title,abstract,type"
        }

        headers = {
            "User-Agent": "RBL-ResearchTool/2.0 (mailto:rbl.researcher@university.edu)"
        }

        try:
            response = self._make_request("GET", "works", params=params, headers=headers)
            data = response.json()
            items = data.get("message", {}).get("items", [])

            papers = []
            for item in items:
                try:
                    title_list = item.get("title", [])
                    title = title_list[0] if title_list else "Untitled"

                    # Year
                    pub = item.get("published", {})
                    date_parts = pub.get("date-parts", [[]])[0]
                    year = int(date_parts[0]) if date_parts else 2024

                    if year < effective_year:
                        continue

                    # Authors
                    authors_list = []
                    for a in item.get("author", []):
                        given = a.get("given", "")
                        family = a.get("family", "")
                        name = f"{given} {family}".strip() if given or family else a.get("name", "")
                        if name:
                            authors_list.append(name)
                    authors = ", ".join(authors_list) if authors_list else "Unknown Authors"

                    doi = item.get("DOI", "N/A")
                    url = f"https://doi.org/{doi}" if doi != "N/A" else ""

                    container = item.get("container-title", [])
                    venue = container[0] if container else "CrossRef Index"

                    raw_abstract = item.get("abstract", "")
                    abstract = re.sub(r"<[^>]+>", "", raw_abstract).strip() if raw_abstract else "N/A"

                    papers.append({
                        "title": title,
                        "authors": authors,
                        "year": year,
                        "venue": venue,
                        "abstract": abstract,
                        "doi": doi,
                        "url": url,
                        "source": "CrossRef",
                        "citations_count": 0
                    })
                except Exception as e:
                    logger.warning(f"Error parsing CrossRef item: {e}")
                    continue

            return papers
        except Exception as e:
            logger.error(f"CrossRef query failed: {e}")
            return []
