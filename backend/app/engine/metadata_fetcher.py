import re
import io
import json
import logging
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from typing import Dict, Any, Optional

try:
    import pypdf
except ImportError:
    pypdf = None

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
        s = s.split('?')[0].split('#')[0]
        m = re.search(r'\b(10\.\d{4,9}/[-._;()/:A-Za-z0-9]+)', s)
        if m:
            doi = m.group(1)
            doi = re.sub(r'[.,;)\]\>]+$', '', doi)
            doi = re.sub(r'\.(html|htm|pdf|xml)$', '', doi, flags=re.IGNORECASE)
            return doi
        return None

    @classmethod
    def extract_arxiv_id(cls, text: str) -> Optional[str]:
        """
        Strictly extracts an arXiv ID from an arXiv URL or explicit arXiv identifier.
        Must NOT match generic URLs like 'researchgate.net/publication/...'.
        """
        if not text:
            return None
        s = text.strip()
        
        # 1. Explicit arXiv URL: arxiv.org/abs/... or arxiv.org/pdf/...
        m_url = re.search(r'arxiv\.org/(?:abs|pdf)/([0-9]{4}\.[0-9]{4,5}(?:v[0-9]+)?|[a-z\-]+/[0-9]{7})', s, flags=re.IGNORECASE)
        if m_url:
            return m_url.group(1)

        # 2. Explicit prefix pattern: arxiv:2303.08774
        m_prefix = re.match(r'^arxiv:\s*([0-9]{4}\.[0-9]{4,5}(?:v[0-9]+)?|[a-z\-]+/[0-9]{7})$', s, flags=re.IGNORECASE)
        if m_prefix:
            return m_prefix.group(1)

        # 3. Pure standalone arXiv ID: e.g. 2303.08774 or 2303.08774v2
        m_pure = re.match(r'^([0-9]{4}\.[0-9]{4,5}(?:v[0-9]+)?)$', s)
        if m_pure:
            return m_pure.group(1)

        return None

    @classmethod
    def extract_title_slug_from_url(cls, url: str) -> Optional[str]:
        """
        Extracts human-readable title keywords from research URLs (ResearchGate, ScienceDirect, etc.)
        e.g. 'https://www.researchgate.net/publication/385965458_Federated_Learning_for_Phishing_Detection'
        -> 'Federated Learning for Phishing Detection'
        """
        if not url:
            return None
        clean_url = url.split('?')[0].split('#')[0]
        
        # ResearchGate pattern: /publication/\d+_(.+)
        rg_match = re.search(r'/publication/\d+_(.+)', clean_url)
        if rg_match:
            slug = rg_match.group(1)
            # Replace underscores and dashes with spaces
            title = re.sub(r'[_\-]+', ' ', slug).strip()
            return title

        # General URL slug pattern: /article/... or /paper/...
        last_seg = clean_url.rstrip('/').split('/')[-1]
        if last_seg and len(last_seg) > 10 and '_' in last_seg or '-' in last_seg:
            # Strip trailing extension
            last_seg = re.sub(r'\.(html|htm|pdf|xml)$', '', last_seg, flags=re.IGNORECASE)
            title = re.sub(r'^[0-9]+[_\-]', '', last_seg) # Remove leading ID
            title = re.sub(r'[_\-]+', ' ', title).strip()
            if len(title.split()) >= 3:
                return title

        return None

    @classmethod
    def canonicalize_pdf_url(cls, url: str) -> Optional[str]:
        """
        Maps known academic repository PDF links to their rich HTML metadata landing pages.
        """
        if not url:
            return None
        u = url.strip()

        # 1. ACL Anthology PDF: https://aclanthology.org/2023.emnlp-main.315.pdf -> https://aclanthology.org/2023.emnlp-main.315
        m_acl = re.match(r'^(https?://aclanthology\.org/[^/]+?)\.pdf$', u, re.I)
        if m_acl:
            return m_acl.group(1)

        # 2. arXiv PDF: https://arxiv.org/pdf/2303.08774.pdf -> https://arxiv.org/abs/2303.08774
        m_arxiv = re.search(r'arxiv\.org/pdf/([0-9]{4}\.[0-9]{4,5}(?:v[0-9]+)?|[a-z\-]+/[0-9]{7})(?:\.pdf)?', u, re.I)
        if m_arxiv:
            return f"https://arxiv.org/abs/{m_arxiv.group(1)}"

        # 3. OpenReview PDF: https://openreview.net/pdf?id=xxx -> https://openreview.net/forum?id=xxx
        m_openrev = re.search(r'openreview\.net/pdf\?id=([a-zA-Z0-9_\-]+)', u, re.I)
        if m_openrev:
            return f"https://openreview.net/forum?id={m_openrev.group(1)}"

        # 4. BioRxiv / MedRxiv PDF
        m_biorxiv = re.match(r'^(https?://www\.(?:biorxiv|medrxiv)\.org/content/.+?)(?:\.full)?\.pdf$', u, re.I)
        if m_biorxiv:
            return m_biorxiv.group(1)

        # 5. ResearchGate Download PDF
        m_rg = re.match(r'^(https?://www\.researchgate\.net/publication/[0-9]+_[^/?#]+)(?:/download|\.pdf)', u, re.I)
        if m_rg:
            return m_rg.group(1)

        # 6. Semantic Scholar PDF
        m_s2 = re.match(r'^(https?://www\.semanticscholar\.org/paper/[^/?#]+/[a-f0-9]+)\.pdf$', u, re.I)
        if m_s2:
            return m_s2.group(1)

        # 7. SSRN Delivery PDF
        m_ssrn = re.search(r'papers\.ssrn\.com/.*?abstractid=([0-9]+)', u, re.I)
        if m_ssrn:
            return f"https://papers.ssrn.com/sol3/papers.cfm?abstract_id={m_ssrn.group(1)}"

        # 8. IEEE Xplore stamp
        m_ieee = re.search(r'ieeexplore\.ieee\.org/stamp/stamp\.jsp\?.*?arnumber=([0-9]+)', u, re.I)
        if m_ieee:
            return f"https://ieeexplore.ieee.org/document/{m_ieee.group(1)}"

        return None

    @classmethod
    def fetch_by_pdf_stream(cls, pdf_url: str) -> Optional[Dict[str, Any]]:
        """
        Streams a raw PDF document over HTTP, parses the first page text and metadata dictionary,
        discovers embedded DOIs / arXiv IDs or titles, and resolves full canonical metadata.
        """
        if not pypdf:
            return None

        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            res = requests.get(pdf_url, headers=headers, timeout=14, stream=True)
            if res.status_code != 200:
                return None

            # Download up to 3MB to parse first pages safely
            content = res.raw.read(3 * 1024 * 1024)
            if not content.startswith(b"%PDF"):
                return None

            reader = pypdf.PdfReader(io.BytesIO(content))
            if not reader.pages:
                return None

            # 1. Extract embedded PDF document info
            pdf_meta = reader.metadata or {}
            embedded_title = str(pdf_meta.get("/Title", "") or "").strip()
            embedded_author = str(pdf_meta.get("/Author", "") or "").strip()

            # 2. Extract page 1 text
            page1_text = reader.pages[0].extract_text() or ""

            # 3. Check for DOI inside page text
            doi_match = cls.extract_doi(page1_text)
            if doi_match:
                logger.info(f"Found DOI inside PDF first page: {doi_match}")
                doi_res = cls.fetch_by_doi(doi_match)
                if doi_res and doi_res.get("title"):
                    doi_res["url"] = pdf_url
                    doi_res["source"] = f"PDF Stream (DOI: {doi_match})"
                    return doi_res

            # 4. Check for arXiv ID inside page text
            arxiv_match = cls.extract_arxiv_id(page1_text)
            if arxiv_match:
                logger.info(f"Found arXiv ID inside PDF first page: {arxiv_match}")
                arxiv_res = cls.fetch_by_arxiv(arxiv_match)
                if arxiv_res and arxiv_res.get("title"):
                    arxiv_res["url"] = pdf_url
                    arxiv_res["source"] = f"PDF Stream (arXiv: {arxiv_match})"
                    return arxiv_res

            # 5. Extract Abstract section from Page 1 text
            abstract_text = ""
            m_abs = re.search(r'\bAbstract\s*[:\-—]?\s*(.*?)(?=\n\s*(?:(?:1|I)[\.\s]|Introduction|Keywords|Index Terms|Key words))', page1_text, re.DOTALL | re.IGNORECASE)
            if m_abs:
                abstract_text = cls.clean_html_tags(m_abs.group(1))

            # 6. Extract Candidate Title from text or metadata
            candidate_title = embedded_title
            if not candidate_title or candidate_title.lower().endswith('.pdf') or len(candidate_title) < 5:
                # Extract first bold/distinctive lines before authors/abstract
                lines = [ln.strip() for ln in page1_text.split('\n') if ln.strip() and len(ln.strip()) > 3]
                filtered_lines = []
                for ln in lines[:8]:
                    if not any(h in ln.lower() for h in ['proceedings of', 'copyright', 'isbn', 'issn', 'http', 'vol.', 'no.', 'pages']):
                        filtered_lines.append(ln)
                if filtered_lines:
                    candidate_title = filtered_lines[0]
                    if len(filtered_lines) > 1 and len(filtered_lines[0].split()) < 5:
                        candidate_title += " " + filtered_lines[1]

            # 7. Search OpenAlex with extracted title for enriched metadata
            if candidate_title and len(candidate_title.split()) >= 3:
                oa_res = cls.fetch_by_title_query(candidate_title)
                if oa_res and oa_res.get("title"):
                    if not oa_res.get("abstract") or oa_res["abstract"] == "N/A":
                        oa_res["abstract"] = abstract_text or "N/A"
                    oa_res["url"] = pdf_url
                    oa_res["source"] = "PDF Stream (via OpenAlex Search)"
                    return oa_res

            # 8. Fallback to direct PDF page 1 extraction
            if candidate_title or abstract_text:
                return {
                    "title": candidate_title or "Untitled PDF Document",
                    "authors": embedded_author or "",
                    "year": 2024,
                    "venue": "",
                    "abstract": abstract_text or "N/A",
                    "doi": "",
                    "url": pdf_url,
                    "source": "PDF Stream Ingestion",
                    "citations_count": 0
                }
        except Exception as e:
            logger.warning(f"Direct PDF stream ingestion error for {pdf_url}: {e}")

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
            "source": "CrossRef / DOI",
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

        # 2. If Abstract is missing or short, query OpenAlex
        if not result["abstract"] or result["abstract"] == "N/A" or len(result["abstract"]) < 40:
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
            if scraped.get("abstract") and scraped["abstract"] != "N/A":
                result["abstract"] = scraped["abstract"]
            if not result["title"] and scraped.get("title"):
                result["title"] = scraped["title"]
            if not result["authors"] and scraped.get("authors"):
                result["authors"] = scraped["authors"]

        if not result["abstract"]:
            result["abstract"] = "N/A"

        return result

    @classmethod
    def fetch_by_title_query(cls, title_query: str) -> Optional[Dict[str, Any]]:
        """
        Queries OpenAlex search API using a publication title string to recover full canonical metadata.
        """
        if not title_query or len(title_query.strip()) < 8:
            return None
        
        try:
            url = f"https://api.openalex.org/works?search={requests.utils.quote(title_query)}&per_page=1"
            res = requests.get(url, timeout=10)
            if res.status_code == 200:
                data = res.json()
                results = data.get("results", [])
                if results:
                    item = results[0]
                    
                    # Authors
                    authors_list = []
                    for a in item.get("authorships", []):
                        auth = a.get("author", {})
                        if auth.get("display_name"):
                            authors_list.append(auth["display_name"])
                    authors_str = ", ".join(authors_list) if authors_list else "Unknown Authors"

                    # Abstract reconstruction
                    abstract_str = "N/A"
                    inv_index = item.get("abstract_inverted_index")
                    if inv_index and isinstance(inv_index, dict):
                        word_positions = []
                        for word, positions in inv_index.items():
                            for pos in positions:
                                word_positions.append((pos, word))
                        word_positions.sort(key=lambda x: x[0])
                        abstract_str = " ".join([w[1] for w in word_positions])

                    # Venue
                    loc = item.get("primary_location", {}) or {}
                    src = loc.get("source", {}) or {}
                    venue_str = src.get("display_name", "") or item.get("type", "")

                    doi_clean = (item.get("doi") or "").replace("https://doi.org/", "")

                    return {
                        "title": item.get("title", title_query),
                        "authors": authors_str,
                        "year": int(item.get("publication_year") or 2024),
                        "venue": venue_str,
                        "abstract": abstract_str,
                        "doi": doi_clean,
                        "url": item.get("doi") or f"https://openalex.org/{item.get('id')}",
                        "source": "OpenAlex Search",
                        "citations_count": int(item.get("cited_by_count") or 0)
                    }
        except Exception as e:
            logger.warning(f"Title search lookup warning for '{title_query}': {e}")

        return None

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
    def fetch_via_jina_reader(cls, target_url: str) -> Dict[str, Any]:
        """
        Fallback scraper using Jina AI Reader (https://r.jina.ai/{url})
        Transforms JavaScript-rendered pages into structured clean markdown.
        """
        result = {"title": "", "authors": "", "abstract": ""}
        try:
            jina_url = f"https://r.jina.ai/{target_url}"
            headers = {
                "User-Agent": "RBL-ResearchTool/2.0",
                "X-Return-Format": "markdown"
            }
            res = requests.get(jina_url, headers=headers, timeout=12)
            if res.status_code == 200 and res.text:
                text = res.text.strip()
                lines = text.split("\n")

                # Filter out Cloudflare challenge responses
                if "Just a moment..." in text or "Security check required" in text or "Attention Required!" in text:
                    return result

                # Extract Title
                for l in lines[:15]:
                    l_str = l.strip()
                    if l_str.startswith("# ") and len(l_str) > 5 and "Just a moment" not in l_str:
                        result["title"] = l_str[2:].strip()
                        break
                    elif l_str.startswith("Title:") and "Just a moment" not in l_str:
                        result["title"] = l_str.replace("Title:", "").strip()
                        break

                # Extract Abstract
                abs_match = re.search(r'(?:##\s*Abstract|###\s*Abstract|\*\*Abstract\*\*|Abstract:)([\s\S]*?)(?:##|###|\*\*References\*\*|References:|Keywords:|$)', text, re.IGNORECASE)
                if abs_match:
                    clean_abs = abs_match.group(1).strip()
                    clean_abs = re.sub(r'[\r\n]+', ' ', clean_abs)
                    if len(clean_abs) >= 30:
                        result["abstract"] = clean_abs

                # Extract Authors if present
                auth_match = re.search(r'(?:Authors?:|By:)\s*([^\n\r]+)', text, re.IGNORECASE)
                if auth_match:
                    result["authors"] = auth_match.group(1).strip()
        except Exception as je:
            logger.warning(f"Jina Reader fallback warning: {je}")

        return result

    @classmethod
    def scrape_html_metadata(cls, target_url: str) -> Dict[str, Any]:
        """
        Deep multi-tier academic scraper supporting ResearchGate, IEEE, ScienceDirect, Springer, Nature, etc.
        """
        domain_source = "Web Scraper"
        if "researchgate.net" in target_url:
            domain_source = "ResearchGate"
        elif "ieee.org" in target_url:
            domain_source = "IEEE Xplore"
        elif "sciencedirect.com" in target_url:
            domain_source = "ScienceDirect"
        elif "springer.com" in target_url or "nature.com" in target_url:
            domain_source = "Springer/Nature"
        elif "acm.org" in target_url:
            domain_source = "ACM Digital Library"

        title_slug = cls.extract_title_slug_from_url(target_url)

        result = {
            "title": title_slug or "",
            "authors": "",
            "year": 2024,
            "venue": "",
            "abstract": "",
            "doi": "",
            "url": target_url,
            "source": domain_source,
            "citations_count": 0
        }

        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Ch-Ua-Platform": '"Windows"'
            }
            res = requests.get(target_url, headers=headers, timeout=12, allow_redirects=True)
            
            # Check if page is blocked by Cloudflare ("Just a moment...", 403, 503)
            is_cf_block = res.status_code in [403, 503] or "Just a moment..." in res.text or "Security check required" in res.text

            if res.status_code == 200 and not is_cf_block:
                soup = BeautifulSoup(res.text, "html.parser")
                
                # 1. Check for Embedded DOI on the webpage
                found_doi = None
                doi_meta = (
                    soup.find("meta", {"name": re.compile(r"citation_doi|dc\.identifier\.doi|dc\.identifier", re.IGNORECASE)}) or
                    soup.find("meta", {"property": re.compile(r"citation_doi|doi", re.IGNORECASE)})
                )
                if doi_meta and doi_meta.get("content"):
                    found_doi = cls.extract_doi(doi_meta["content"])
                
                if not found_doi:
                    doi_link = soup.find("a", href=re.compile(r"doi\.org/10\.\d{4,9}/", re.IGNORECASE))
                    if doi_link and doi_link.get("href"):
                        found_doi = cls.extract_doi(doi_link["href"])

                if not found_doi:
                    body_text = res.text[:20000]
                    found_doi = cls.extract_doi(body_text)

                # IF DOI IS FOUND: Query CrossRef for gold-standard canonical metadata!
                if found_doi:
                    logger.info(f"Discovered embedded DOI [{found_doi}] from {target_url}. Forwarding to CrossRef / OpenAlex...")
                    doi_meta_data = cls.fetch_by_doi(found_doi)
                    if doi_meta_data.get("title") and doi_meta_data["title"] != "Untitled":
                        doi_meta_data["url"] = target_url
                        doi_meta_data["source"] = f"{domain_source} (DOI: {found_doi})"
                        return doi_meta_data

                # 2. JSON-LD Structured Schema Extraction (<script type="application/ld+json">)
                for script in soup.find_all("script", {"type": "application/ld+json"}):
                    try:
                        if not script.string:
                            continue
                        ld_data = json.loads(script.string)
                        if isinstance(ld_data, list):
                            ld_data = ld_data[0]
                        if isinstance(ld_data, dict):
                            if (ld_data.get("headline") or ld_data.get("name")):
                                result["title"] = cls.clean_html_tags(ld_data.get("headline") or ld_data.get("name"))
                            
                            if ld_data.get("description"):
                                clean_d = cls.clean_html_tags(ld_data.get("description"))
                                if len(clean_d) >= 30:
                                    result["abstract"] = clean_d

                            if ld_data.get("author"):
                                auths = ld_data.get("author")
                                if isinstance(auths, list):
                                    a_names = [a.get("name") for a in auths if isinstance(a, dict) and a.get("name")]
                                    if a_names:
                                        result["authors"] = ", ".join(a_names)
                                elif isinstance(auths, dict) and auths.get("name"):
                                    result["authors"] = auths.get("name")

                            if ld_data.get("datePublished"):
                                m_y = re.search(r'\b(19\d\d|20\d\d)\b', str(ld_data.get("datePublished")))
                                if m_y:
                                    result["year"] = int(m_y.group(1))
                    except Exception:
                        pass

                # 3. HighWire & Dublin Core Meta Tags
                if not result["title"] or result["title"] == title_slug:
                    meta_title = (
                        soup.find("meta", {"name": re.compile(r"citation_title|dc\.title", re.IGNORECASE)}) or
                        soup.find("meta", {"property": "og:title"}) or
                        soup.find("meta", {"name": "twitter:title"})
                    )
                    if meta_title and meta_title.get("content"):
                        t_cand = cls.clean_html_tags(meta_title["content"])
                        if "Just a moment" not in t_cand:
                            result["title"] = t_cand

                if not result["authors"]:
                    author_tags = soup.find_all("meta", {"name": re.compile(r"citation_author|dc\.creator", re.IGNORECASE)})
                    authors = [cls.clean_html_tags(tag["content"]) for tag in author_tags if tag.get("content")]
                    if authors:
                        result["authors"] = ", ".join(authors)

                if not result["abstract"]:
                    abs_tag = (
                        soup.find("meta", {"name": re.compile(r"citation_abstract|dc\.description", re.IGNORECASE)}) or
                        soup.find("meta", {"property": "og:description"}) or
                        soup.find("meta", {"name": "description"})
                    )
                    if abs_tag and abs_tag.get("content"):
                        clean_abs = cls.clean_html_tags(abs_tag["content"])
                        if len(clean_abs) >= 30 and "Cloudflare" not in clean_abs:
                            result["abstract"] = clean_abs

                # Date / Year
                date_tag = (
                    soup.find("meta", {"name": re.compile(r"citation_publication_date|citation_date|dc\.date", re.IGNORECASE)})
                )
                if date_tag and date_tag.get("content"):
                    m_year = re.search(r'\b(19\d\d|20\d\d)\b', date_tag["content"])
                    if m_year:
                        result["year"] = int(m_year.group(1))

                # Journal / Venue
                venue_tag = (
                    soup.find("meta", {"name": re.compile(r"citation_journal_title|citation_conference_title|dc\.source", re.IGNORECASE)})
                )
                if venue_tag and venue_tag.get("content"):
                    result["venue"] = cls.clean_html_tags(venue_tag["content"])

                # 4. DOM Selectors
                if not result["title"]:
                    rg_title = soup.find(["h1", "h2"], class_=re.compile(r"title|research-detail-header", re.IGNORECASE))
                    if rg_title:
                        result["title"] = cls.clean_html_tags(rg_title.get_text())

                if not result["authors"]:
                    auth_links = soup.find_all("a", href=re.compile(r"/profile/", re.IGNORECASE))
                    auth_names = [cls.clean_html_tags(a.get_text()) for a in auth_links if len(a.get_text().strip()) > 3]
                    if auth_names:
                        seen = set()
                        dedup_auth = [x for x in auth_names if not (x in seen or seen.add(x))]
                        result["authors"] = ", ".join(dedup_auth[:8])

                if not result["abstract"] or len(result["abstract"]) < 40:
                    for selector in [
                        ".nova-legacy-e-text--color-grey-800",
                        "[itemprop='description']",
                        ".abstractSection",
                        ".abstract",
                        "#abstract",
                        ".article-abstract",
                        "section[aria-label='Abstract']",
                        ".section-abstract"
                    ]:
                        elem = soup.select_one(selector)
                        if elem:
                            text = cls.clean_html_tags(elem.get_text())
                            text = re.sub(r'^Abstract\s*[:\-]?\s*', '', text, flags=re.IGNORECASE)
                            if len(text) >= 40:
                                result["abstract"] = text
                                break

        except Exception as e:
            logger.warning(f"HTML scraping warning for {target_url}: {e}")

        # 5. Smart Title-Search Fallback via OpenAlex:
        # If Cloudflare blocked direct HTML or Title/Abstract is missing, use the URL slug to query OpenAlex!
        search_query_title = result.get("title") or title_slug
        if search_query_title and (not result["authors"] or not result["abstract"] or result["abstract"] == "N/A" or len(result["abstract"]) < 40):
            logger.info(f"Triggering OpenAlex title-search fallback for slug query: '{search_query_title}'...")
            oa_search_result = cls.fetch_by_title_query(search_query_title)
            if oa_search_result:
                if oa_search_result.get("title"):
                    result["title"] = oa_search_result["title"]
                if oa_search_result.get("authors") and not result["authors"]:
                    result["authors"] = oa_search_result["authors"]
                if oa_search_result.get("abstract") and oa_search_result["abstract"] != "N/A":
                    result["abstract"] = oa_search_result["abstract"]
                if oa_search_result.get("year"):
                    result["year"] = oa_search_result["year"]
                if oa_search_result.get("venue") and not result["venue"]:
                    result["venue"] = oa_search_result["venue"]
                if oa_search_result.get("doi"):
                    result["doi"] = oa_search_result["doi"]
                if oa_search_result.get("citations_count"):
                    result["citations_count"] = oa_search_result["citations_count"]
                result["source"] = f"{domain_source} (via OpenAlex Search)"

        # Clean Title formatting
        if result["title"]:
            result["title"] = re.sub(r'^\(PDF\)\s*', '', result["title"]).strip()
            result["title"] = re.sub(r'\s*\|\s*(ResearchGate|ScienceDirect|IEEE Xplore|SpringerLink).*$', '', result["title"]).strip()

        if not result["abstract"]:
            result["abstract"] = "N/A"

        return result

    @classmethod
    def resolve_identifier(cls, raw_input: str) -> Dict[str, Any]:
        """
        Universal entry point: auto-detects DOI, ArXiv, PDF URLs, academic links, or titles and fetches canonical metadata.
        """
        inp = raw_input.strip()
        
        # 0. Canonicalize academic PDF URLs (e.g. aclanthology.org/2023.emnlp-main.315.pdf -> aclanthology.org/2023.emnlp-main.315)
        canon_url = cls.canonicalize_pdf_url(inp)
        if canon_url and canon_url != inp:
            logger.info(f"Canonicalized PDF URL: {inp} -> {canon_url}")
            res = cls.resolve_identifier(canon_url)
            if res and res.get("title") and res.get("title") != canon_url:
                res["url"] = inp # Preserve original user input URL
                return res

        # 1. Check for DOI URL or DOI string (e.g. 10.1145/... or https://doi.org/10.1145/...)
        extracted_doi = cls.extract_doi(inp)
        if extracted_doi and ("doi.org" in inp.lower() or inp.lower().startswith("10.") or "doi:" in inp.lower()):
            logger.info(f"Resolving as DOI: {extracted_doi}")
            return cls.fetch_by_doi(extracted_doi)

        # 2. Check strictly for ArXiv URL or ArXiv ID
        extracted_arxiv = cls.extract_arxiv_id(inp)
        if extracted_arxiv:
            logger.info(f"Resolving as ArXiv: {extracted_arxiv}")
            return cls.fetch_by_arxiv(extracted_arxiv)

        # 3. Direct PDF Document stream parsing (if ends in .pdf or looks like direct PDF document)
        if (inp.startswith("http://") or inp.startswith("https://")) and inp.lower().split('?')[0].endswith('.pdf'):
            logger.info(f"Resolving as direct PDF stream: {inp}")
            pdf_res = cls.fetch_by_pdf_stream(inp)
            if pdf_res and pdf_res.get("title") and pdf_res.get("title") != "Untitled PDF Document":
                return pdf_res

        # 4. If standard URL (ResearchGate, IEEE, ScienceDirect, Springer, etc.), scrape HTML metadata & OpenAlex
        if inp.startswith("http://") or inp.startswith("https://"):
            logger.info(f"Resolving as academic URL: {inp}")
            html_res = cls.scrape_html_metadata(inp)
            if html_res and html_res.get("title") and html_res["title"] != inp:
                return html_res
            # If HTML scraping yielded empty title, try direct PDF stream as backup
            pdf_res = cls.fetch_by_pdf_stream(inp)
            if pdf_res and pdf_res.get("title") and pdf_res.get("title") != "Untitled PDF Document":
                return pdf_res
            return html_res

        # 5. If plain text DOI without protocol (e.g. 10.3844/jcssp.2025...)
        if extracted_doi:
            logger.info(f"Resolving as raw DOI: {extracted_doi}")
            return cls.fetch_by_doi(extracted_doi)

        # 6. If pure text title, try OpenAlex Title Search
        if len(inp.split()) >= 3:
            oa_res = cls.fetch_by_title_query(inp)
            if oa_res:
                return oa_res

        # 7. Fallback default
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
