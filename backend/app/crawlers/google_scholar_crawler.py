import re
import urllib.parse
from bs4 import BeautifulSoup
import logging
from typing import List, Dict, Any
from .base import BaseAPIClient, USER_AGENTS

logger = logging.getLogger(__name__)

class GoogleScholarCrawler(BaseAPIClient):
    def __init__(self):
        super().__init__(
            base_url="https://scholar.google.com",
            rate_limit_per_second=0.5, # Safe rate limit for Google Scholar
            timeout=10,
            max_retries=1,
            api_type="google_scholar"
        )

    def search(self, query: str, limit: int = 20, start_year: int = 2020, since_year: Optional[int] = None, **kwargs) -> List[Dict[str, Any]]:
        """
        Scrapes Google Scholar search results with resilient HTML parsing and anti-blocking fallbacks.
        """
        effective_year = since_year if since_year is not None else start_year
        encoded_query = urllib.parse.quote_plus(query)
        endpoint = f"scholar?q={encoded_query}&as_ylo={effective_year}&hl=en&num={min(limit, 20)}"
        
        headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1"
        }

        try:
            response = self._make_request("GET", endpoint, headers=headers)
            
            # Check for CAPTCHA/bot detection
            if "recaptcha" in response.text.lower() or "unusual traffic" in response.text.lower():
                logger.warning("Google Scholar triggered CAPTCHA / bot protection. Gracefully skipping.")
                return []

            soup = BeautifulSoup(response.text, "html.parser")
            results = soup.find_all("div", class_="gs_ri")
            
            papers = []
            for res in results:
                try:
                    # 1. Title & URL
                    title_elem = res.find("h3", class_="gs_rt")
                    if not title_elem:
                        continue
                    
                    # Remove [PDF], [HTML], [BOOK], [CITATION] tags
                    for span in title_elem.find_all("span", class_="gs_ct1"):
                        span.decompose()
                    for span in title_elem.find_all("span", class_="gs_ct2"):
                        span.decompose()
                        
                    title = title_elem.get_text().strip()
                    link_elem = title_elem.find("a")
                    url = link_elem["href"] if link_elem and "href" in link_elem.attrs else ""
                    
                    # 2. Author, Year, Venue from gs_a
                    meta_elem = res.find("div", class_="gs_a")
                    authors = "Unknown Authors"
                    year = 2024
                    venue = "Google Scholar Index"
                    
                    if meta_elem:
                        meta_text = meta_elem.get_text().strip()
                        parts = meta_text.split(" - ")
                        if len(parts) >= 1:
                            authors = parts[0].strip()
                        if len(parts) >= 2:
                            venue_year = parts[1].strip()
                            # Extract 4 digit year
                            year_match = re.search(r'\b(19\d{2}|20\d{2})\b', venue_year)
                            if year_match:
                                year = int(year_match.group(1))
                            venue = re.sub(r',\s*\b(19\d{2}|20\d{2})\b', '', venue_year).strip() or venue
                            
                    if year < start_year:
                        continue

                    # 3. Snippet / Abstract from gs_rs
                    snippet_elem = res.find("div", class_="gs_rs")
                    abstract = snippet_elem.get_text().strip().replace("\n", " ") if snippet_elem else "N/A"

                    # 4. Citations count from gs_fl
                    citations_count = 0
                    bottom_elem = res.find("div", class_="gs_fl")
                    if bottom_elem:
                        cite_match = re.search(r'Cited by (\d+)', bottom_elem.get_text())
                        if cite_match:
                            citations_count = int(cite_match.group(1))

                    papers.append({
                        "title": title,
                        "authors": authors,
                        "year": year,
                        "venue": venue,
                        "abstract": abstract,
                        "doi": "N/A",
                        "url": url,
                        "source": "Google Scholar",
                        "citations_count": citations_count
                    })
                except Exception as e:
                    logger.warning(f"Error parsing individual Google Scholar result: {e}")
                    continue

            return papers
        except Exception as e:
            logger.warning(f"Google Scholar scraping gracefully skipped: {e}")
            return []
