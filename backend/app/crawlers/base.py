import time
import random
import logging
from typing import Optional, Dict, Any
from abc import ABC, abstractmethod
import requests

logger = logging.getLogger(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/119.0",
]

class BaseAPIClient(ABC):
    def __init__(
        self,
        base_url: str,
        api_key: Optional[str] = None,
        rate_limit_per_second: float = 3.0,
        timeout: int = 8,  # Fast 8s timeout
        max_retries: int = 1,  # 1 retry max to keep crawler responsive
        api_type: str = "general"
    ):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.rate_limit_per_second = rate_limit_per_second
        self.min_interval = 1.0 / rate_limit_per_second if rate_limit_per_second > 0 else 0
        self.last_request_time = 0.0
        self.timeout = timeout
        self.max_retries = max_retries
        self.api_type = api_type
        self.session = requests.Session()

    def _rate_limit_wait(self) -> None:
        if self.min_interval <= 0:
            return
        now = time.time()
        elapsed = now - self.last_request_time
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        self.last_request_time = time.time()

    def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        data: Optional[Any] = None
    ) -> requests.Response:
        self._rate_limit_wait()
        
        req_headers = {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "application/json, text/xml, application/xml, */*"
        }
        if headers:
            req_headers.update(headers)

        url = f"{self.base_url}/{endpoint.lstrip('/')}" if endpoint else self.base_url

        try:
            response = self.session.request(
                method=method,
                url=url,
                params=params,
                headers=req_headers,
                data=data,
                timeout=self.timeout
            )
            if response.status_code == 429:
                logger.warning(f"Rate limited (429) on {self.api_type}.")
                raise requests.exceptions.HTTPError("Rate limited (429)", response=response)
            
            response.raise_for_status()
            return response
        except Exception as e:
            logger.warning(f"Request failed for {self.api_type} ({url}): {e}")
            raise

    @abstractmethod
    def search(self, query: str, limit: int = 25, start_year: int = 2020) -> list:
        pass
