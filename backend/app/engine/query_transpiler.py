import re

class QueryTranspiler:
    @staticmethod
    def to_arxiv(query: str) -> str:
        """
        Translates a Boolean query into ArXiv Lucene search_query syntax.
        Example: ("phishing" OR "scam") AND ("LLM" OR "PhoBERT")
        ArXiv needs all: prefix before terms or parentheses groups.
        """
        q = query.strip()
        if not q:
            return "all:(scam OR phishing)"
            
        # If user already specified prefixes, return as is
        if any(q.startswith(p) for p in ["all:", "ti:", "abs:", "cat:"]):
            return q
            
        # Clean up quotes and ensure syntax
        # For ArXiv, wrap terms with all:(...)
        return f"all:({q})"

    @staticmethod
    def to_openalex(query: str) -> str:
        """
        OpenAlex 'search' param expects natural language or cleaned terms without Boolean syntax
        or handles keyword phrases.
        """
        q = query.strip()
        if not q:
            return "scam phishing detection"
        
        # Remove parentheses for clean OpenAlex fulltext search
        cleaned = re.sub(r'[\(\)]', ' ', q)
        # Replace AND / OR with spaces
        cleaned = re.sub(r'\b(AND|OR|NOT)\b', ' ', cleaned)
        # Collapse multiple spaces
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        return cleaned if cleaned else q

    @staticmethod
    def to_semantic_scholar(query: str) -> str:
        """
        Semantic Scholar Graph API query parameter works best with primary topic phrases.
        """
        q = query.strip()
        if not q:
            return "scam message classification"
            
        # Remove parentheses and Boolean operators
        cleaned = re.sub(r'[\(\)]', ' ', q)
        cleaned = re.sub(r'\b(AND|OR|NOT)\b', ' ', cleaned)
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        return cleaned if cleaned else q
