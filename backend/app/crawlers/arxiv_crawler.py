import xml.etree.ElementTree as ET
import logging
from typing import List, Dict, Any
from .base import BaseAPIClient

logger = logging.getLogger(__name__)

ATOM_NS = "{http://www.w3.org/2005/Atom}"
ARXIV_NS = "{http://arxiv.org/schemas/atom}"

class ArxivCrawler(BaseAPIClient):
    def __init__(self):
        super().__init__(
            base_url="https://export.arxiv.org/api",
            rate_limit_per_second=0.33,  # Strict 3-second delay per ArXiv harvest guidelines
            timeout=25,
            max_retries=3,
            api_type="arxiv"
        )

    def search(self, query: str, limit: int = 25, start_year: int = 2020, since_year: Optional[int] = None, **kwargs) -> List[Dict[str, Any]]:
        effective_year = since_year if since_year is not None else start_year
        # Format query: if not already formatted with prefixes, search in all/title/abstract
        search_query = query.strip()
        if not any(search_query.startswith(prefix) for prefix in ["all:", "ti:", "abs:", "cat:"]):
            search_query = f"all:({search_query})"

        params = {
            "search_query": search_query,
            "start": 0,
            "max_results": min(limit, 100),
            "sortBy": "submittedDate",
            "sortOrder": "descending"
        }

        try:
            response = self._make_request("GET", "query", params=params)
            root = ET.fromstring(response.text)
            
            papers = []
            for entry in root.findall(f"{ATOM_NS}entry"):
                try:
                    # Extract basic fields
                    title_elem = entry.find(f"{ATOM_NS}title")
                    title = title_elem.text.strip().replace("\n", " ") if title_elem is not None and title_elem.text else "Untitled"
                    
                    summary_elem = entry.find(f"{ATOM_NS}summary")
                    abstract = summary_elem.text.strip().replace("\n", " ") if summary_elem is not None and summary_elem.text else "N/A"
                    
                    published_elem = entry.find(f"{ATOM_NS}published")
                    year = int(published_elem.text[:4]) if published_elem is not None and published_elem.text else 2024
                    
                    # Filter by start year
                    if year < effective_year:
                        continue

                    # Authors
                    authors_list = []
                    for author_elem in entry.findall(f"{ATOM_NS}author"):
                        name_elem = author_elem.find(f"{ATOM_NS}name")
                        if name_elem is not None and name_elem.text:
                            authors_list.append(name_elem.text.strip())
                    authors = ", ".join(authors_list) if authors_list else "Unknown Authors"

                    # DOI & Journal Ref
                    doi_elem = entry.find(f"{ARXIV_NS}doi")
                    doi = doi_elem.text.strip() if doi_elem is not None and doi_elem.text else "N/A"

                    journal_elem = entry.find(f"{ARXIV_NS}journal_ref")
                    venue = journal_elem.text.strip() if journal_elem is not None and journal_elem.text else "arXiv preprint"

                    # Canonical Link
                    link_elem = entry.find(f"{ATOM_NS}link[@rel='alternate']")
                    url = link_elem.attrib.get("href", "") if link_elem is not None else ""
                    if not url:
                        id_elem = entry.find(f"{ATOM_NS}id")
                        url = id_elem.text.strip() if id_elem is not None and id_elem.text else ""

                    # Extract arXiv ID if DOI is missing
                    if doi == "N/A" and "abs/" in url:
                        arxiv_id = url.split("abs/")[-1]
                        doi = f"10.48550/arXiv.{arxiv_id}"

                    papers.append({
                        "title": title,
                        "authors": authors,
                        "year": year,
                        "venue": venue,
                        "abstract": abstract,
                        "doi": doi,
                        "url": url,
                        "source": "ArXiv",
                        "citations_count": 0
                    })
                except Exception as e:
                    logger.warning(f"Error parsing individual arXiv entry: {e}")
                    continue

            return papers
        except Exception as e:
            logger.error(f"ArXiv query failed: {e}")
            return []
