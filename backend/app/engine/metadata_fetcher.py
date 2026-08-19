import re
import logging
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

ATOM_NS = "{http://www.w3.org/2005/Atom}"
ARXIV_NS = "{http://arxiv.org/schemas/atom}"

class MetadataFetcher:
    @staticmethod
    def clean_html_tags(raw_html: str) -> str:
        if not raw_html:
            return ""
        # Remove XML/HTML tags like <jats:p>, <jats:title>, etc.
        cleaned = re.sub(r'<[^>]+>', ' ', raw_html)
        return re.sub(r'\s+', ' ', cleaned).strip()

    @classmethod
    def extract_doi(cls, text: str) -> Optional[str]:
        """
        Extracts a clean DOI from a URL or raw string.
        e.g. 'https://doi.org/10.1145/3372278.3390678' -> '10.1145/3372278.3390678'
        """
        if not text:
            return None
        s = text.strip()
        m = re.search(r'\b(10\.\d{4,9}/[-._;()/:A-Za-z0-9]+)', s)
        if m:
            doi = m.group(1)
            # Strip trailing punctuation if present
            return doi.rstrip('.,;)')
        return None

    @classmethod
    def extract_arxiv_id(cls, text: str) -> Optional[str]:
        """
        Extracts an arXiv ID from a URL or raw string.
        e.g. 'https://arxiv.org/abs/2303.08774' -> '2303.08774'
        """
        if not text:
            return None
        s = text.strip()
        m = re.search(r'(?:arxiv\.org/(?:abs|pdf)/|arxiv:)?(\d{4}\.\d{4,5}(?:v\d+)?|[a-z\-]+/\d{7})', s, flags=re.IGNORECASE)
        if m:
            return m.group(1)
        return None

    @classmethod
    def fetch_by_doi(cls, doi: str) -> Dict[str, Any]:
        """
        Fetches paper metadata using CrossRef API and OpenAlex API.
        """
        clean_doi = cls.extract_doi(doi) or doi.strip()
        result = {
            "title": "",
            "authors": "",
            "year": 2024,
            "venue": "",
            "abstract": "",
            "doi": clean_doi,
            "url": f"https://doi.org/{clean_doi}",
            "source": "CrossRef/DOI",
            "citations_count": 0
        }

        # 1. Query CrossRef
        try:
            url = f"https://api.crossref.org/works/{clean_doi}"
            headers = {"User-Agent": "RBL-ResearchTool/2.0 (mailto:researcher@rbl.org)"}
            res = requests.get(url, headers=headers, timeout=12)
            if res.status_code == 200:
                data = res.json().get("message", {})
                
                title_list = data.get("title", [])
                if title_list:
                    result["title"] = cls.clean_html_tags(title_list[0])

                # Authors
                author_list = []
                for a in data.get("author", []):
                    given = a.get("given", "")
                    family = a.get("family", "")
                    name = f"{given} {family}".strip() if given or family else a.get("name", "")
                    if name:
                        author_list.append(name)
                if author_list:
                    result["authors"] = ", ".join(author_list)

                # Year
                published = data.get("published", {}) or data.get("published-print", {}) or data.get("published-online", {})
                date_parts = published.get("date-parts", [[]])[0]
                if date_parts:
                    try:
                        result["year"] = int(date_parts[0])
                    except Exception:
                        pass

                # Venue
                container = data.get("container-title", [])
                if container:
                    result["venue"] = container[0]

                # Abstract
                raw_abs = data.get("abstract", "")
                if raw_abs:
                    result["abstract"] = cls.clean_html_tags(raw_abs)

                # Citations count
                result["citations_count"] = int(data.get("is-referenced-by-count") or 0)
        except Exception as e:
            logger.warning(f"CrossRef lookup warning for DOI {clean_doi}: {e}")

        # 2. If Abstract is missing, query OpenAlex
        if not result["abstract"] or result["abstract"] == "N/A":
            try:
                oa_url = f"https://api.openalex.org/works/https://doi.org/{clean_doi}"
                oa_res = requests.get(oa_url, timeout=10)
                if oa_res.status_code == 200:
                    oa_data = oa_res.json()
                    if not result["title"] and oa_data.get("title"):
                        result["title"] = oa_data.get("title")

                    # OpenAlex abstract inverted index reconstruction
                    inv_index = oa_data.get("abstract_inverted_index")
                    if inv_index and isinstance(inv_index, dict):
                        word_positions = []
                        for word, positions in inv_index.items():
                            for pos in positions:
                                word_positions.append((pos, word))
                        word_positions.sort(key=lambda x: x[0])
                        result["abstract"] = " ".join([w[1] for w in word_positions])

                    if not result["venue"]:
                        loc = oa_data.get("primary_location", {}) or {}
                        src = loc.get("source", {}) or {}
                        result["venue"] = src.get("display_name", "")

                    if result["citations_count"] == 0 and oa_data.get("cited_by_count"):
                        result["citations_count"] = int(oa_data.get("cited_by_count"))
            except Exception as oa_err:
                logger.warning(f"OpenAlex fallback warning for DOI {clean_doi}: {oa_err}")

        # 3. Direct Landing Page Scrape for Abstract if still empty
        if not result["abstract"] or len(result["abstract"]) < 40:
            scraped = cls.scrape_html_metadata(f"https://doi.org/{clean_doi}")
            if scraped.get("abstract"):
                result["abstract"] = scraped["abstract"]
            if not result["title"] and scraped.get("title"):
                result["title"] = scraped["title"]
            if not result["authors"] and scraped.get("authors"):
                result["authors"] = scraped["authors"]

        if not result["abstract"]:
            result["abstract"] = "N/A"

        return result

    @classmethod
    def fetch_by_arxiv(cls, arxiv_input: str) -> Dict[str, Any]:
        """
        Fetches paper metadata using ArXiv Atom API.
        """
        arxiv_id = cls.extract_arxiv_id(arxiv_input) or arxiv_input.strip()
        url = f"https://export.arxiv.org/api/query?id_list={arxiv_id}"
        
        result = {
            "title": "",
            "authors": "",
            "year": 2024,
            "venue": "arXiv preprint",
            "abstract": "N/A",
            "doi": f"10.48550/arXiv.{arxiv_id}",
            "url": f"https://arxiv.org/abs/{arxiv_id}",
            "source": "ArXiv",
            "citations_count": 0
        }

        try:
            res = requests.get(url, timeout=12)
            if res.status_code == 200:
                root = ET.fromstring(res.text)
                entry = root.find(f"{ATOM_NS}entry")
                if entry is not None:
                    # Title
                    t_elem = entry.find(f"{ATOM_NS}title")
                    if t_elem is not None and t_elem.text:
                        result["title"] = t_elem.text.strip().replace("\n", " ")

                    # Abstract
                    sum_elem = entry.find(f"{ATOM_NS}summary")
                    if sum_elem is not None and sum_elem.text:
                        result["abstract"] = sum_elem.text.strip().replace("\n", " ")

                    # Published Year
                    pub_elem = entry.find(f"{ATOM_NS}published")
                    if pub_elem is not None and pub_elem.text:
                        try:
                            result["year"] = int(pub_elem.text[:4])
                        except Exception:
                            pass

                    # Authors
                    authors_list = []
                    for auth in entry.findall(f"{ATOM_NS}author"):
                        n_elem = auth.find(f"{ATOM_NS}name")
                        if n_elem is not None and n_elem.text:
                            authors_list.append(n_elem.text.strip())
                    if authors_list:
                        result["authors"] = ", ".join(authors_list)

                    # Official DOI if registered
                    doi_elem = entry.find(f"{ARXIV_NS}doi")
                    if doi_elem is not None and doi_elem.text:
                        result["doi"] = doi_elem.text.strip()

                    # Journal ref
                    jr_elem = entry.find(f"{ARXIV_NS}journal_ref")
                    if jr_elem is not None and jr_elem.text:
                        result["venue"] = jr_elem.text.strip()
        except Exception as ex:
            logger.warning(f"ArXiv query warning for {arxiv_id}: {ex}")

        return result

    @classmethod
    def scrape_html_metadata(cls, target_url: str) -> Dict[str, Any]:
        """
        Scrapes academic metadata from landing pages (HighWire, Dublin Core, OpenGraph).
        """
        result = {
            "title": "",
            "authors": "",
            "year": 2024,
            "venue": "",
            "abstract": "",
            "doi": "",
            "url": target_url,
            "source": "Web Scraper",
            "citations_count": 0
        }

        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
            res = requests.get(target_url, headers=headers, timeout=15, allow_redirects=True)
            if res.status_code == 200:
                soup = BeautifulSoup(res.text, "html.parser")
                
                # Title
                meta_title = (
                    soup.find("meta", {"name": "citation_title"}) or
                    soup.find("meta", {"name": "dc.title"}) or
                    soup.find("meta", {"property": "og:title"})
                )
                if meta_title and meta_title.get("content"):
                    result["title"] = meta_title["content"].strip()
                elif soup.title and soup.title.string:
                    result["title"] = soup.title.string.strip()

                # Authors
                author_tags = soup.find_all("meta", {"name": re.compile(r"citation_author|dc\.creator", re.IGNORECASE)})
                authors = [tag["content"].strip() for tag in author_tags if tag.get("content")]
                if authors:
                    result["authors"] = ", ".join(authors)

                # Date / Year
                date_tag = (
                    soup.find("meta", {"name": "citation_publication_date"}) or
                    soup.find("meta", {"name": "citation_date"}) or
                    soup.find("meta", {"name": "dc.date"})
                )
                if date_tag and date_tag.get("content"):
                    m_year = re.search(r'\b(19\d\d|20\d\d)\b', date_tag["content"])
                    if m_year:
                        result["year"] = int(m_year.group(1))

                # Journal / Venue
                venue_tag = (
                    soup.find("meta", {"name": "citation_journal_title"}) or
                    soup.find("meta", {"name": "citation_conference_title"}) or
                    soup.find("meta", {"name": "dc.source"})
                )
                if venue_tag and venue_tag.get("content"):
                    result["venue"] = venue_tag["content"].strip()

                # DOI
                doi_tag = (
                    soup.find("meta", {"name": "citation_doi"}) or
                    soup.find("meta", {"name": "dc.identifier"}) or
                    soup.find("meta", {"name": "dc.identifier.doi"})
                )
                if doi_tag and doi_tag.get("content"):
                    found_doi = cls.extract_doi(doi_tag["content"])
                    if found_doi:
                        result["doi"] = found_doi

                # Abstract
                abs_tag = (
                    soup.find("meta", {"name": "citation_abstract"}) or
                    soup.find("meta", {"name": "dc.description"}) or
                    soup.find("meta", {"property": "og:description"}) or
                    soup.find("meta", {"name": "description"})
                )
                if abs_tag and abs_tag.get("content"):
                    clean_abs = cls.clean_html_tags(abs_tag["content"])
                    if len(clean_abs) >= 30:
                        result["abstract"] = clean_abs

                # If abstract tag missing, look for common CSS containers
                if not result["abstract"]:
                    for selector in [".abstractSection", ".abstract", "#abstract", ".article-abstract", "section[aria-label='Abstract']", ".section-abstract"]:
                        elem = soup.select_one(selector)
                        if elem:
                            text = cls.clean_html_tags(elem.get_text())
                            if len(text) >= 40:
                                result["abstract"] = text
                                break
        except Exception as e:
            logger.warning(f"HTML scraping warning for {target_url}: {e}")

        return result

    @classmethod
    def resolve_identifier(cls, raw_input: str) -> Dict[str, Any]:
        """
        Universal entry point: auto-detects DOI, ArXiv, or generic URL and fetches canonical metadata.
        """
        inp = raw_input.strip()
        
        # 1. Check for DOI
        extracted_doi = cls.extract_doi(inp)
        if extracted_doi:
            logger.info(f"Resolving as DOI: {extracted_doi}")
            return cls.fetch_by_doi(extracted_doi)

        # 2. Check for ArXiv
        extracted_arxiv = cls.extract_arxiv_id(inp)
        if extracted_arxiv:
            logger.info(f"Resolving as ArXiv: {extracted_arxiv}")
            return cls.fetch_by_arxiv(extracted_arxiv)

        # 3. If standard URL, scrape HTML metadata
        if inp.startswith("http://") or inp.startswith("https://"):
            logger.info(f"Resolving as generic URL: {inp}")
            return cls.scrape_html_metadata(inp)

        # 4. Fallback default
        return {
            "title": inp,
            "authors": "",
            "year": 2024,
            "venue": "",
            "abstract": "N/A",
            "doi": "",
            "url": "",
            "source": "Manual Entry",
            "citations_count": 0
        }
