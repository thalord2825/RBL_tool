from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class SearchRequest(BaseModel):
    query: str
    sources: List[str] = Field(default_factory=lambda: ["ArXiv", "OpenAlex", "Semantic Scholar", "CrossRef", "Google Scholar"])
    since_year: int = 2020
    limit_per_source: int = 25
    project_id: str = "default"
    auto_screen: bool = False
    research_context: Optional[str] = ""
    api_key: Optional[str] = None
    model_name: Optional[str] = "gemini-2.5-flash"
    discard_excluded: bool = False

class PaperUpdate(BaseModel):
    status: Optional[str] = None
    exclusion_reason: Optional[str] = None
    relevance_notes: Optional[str] = None
    tool_model: Optional[str] = None
    dataset_name: Optional[str] = None
    sample_size_n: Optional[str] = None
    metrics_evaluated: Optional[str] = None
    empirical_results: Optional[str] = None
    code_url: Optional[str] = None
    limitations: Optional[str] = None
    ai_decision: Optional[str] = None
    ai_confidence: Optional[float] = None
    ai_rationale: Optional[str] = None
    duplicate_flag: Optional[bool] = None
    duplicate_with_id: Optional[str] = None
    duplicate_reason: Optional[str] = None

class AiScreenRequest(BaseModel):
    api_key: Optional[str] = None
    model_name: Optional[str] = "auto"
    research_question: Optional[str] = "How effective are prompt-based LLMs (few-shot) compared with a fine-tuned PhoBERT model for Vietnamese scam message classification?"
    research_context: Optional[str] = ""
    pico: Dict[str, str] = Field(default_factory=lambda: {
        "P": "Scam messages (SMS, Zalo, Messenger, Email) and fraudulent call scripts targeting users, particularly within the context of the Vietnamese language and community alert platforms.",
        "I": "Text classification based on Large Language Models (LLMs) utilizing In-context Learning techniques (Zero-shot, Few-shot, Few-shot + taxonomy) integrated into software systems.",
        "C": "Fine-tuned Pre-trained Language Models (such as PhoBERT) and traditional filtering mechanisms based on blacklists or keyword matching.",
        "O": "Classification performance (Accuracy, Precision, Recall, Macro-F1 per scam category), system inference latency (< 3 seconds), and API token cost (Cost per request)."
    })
    ic_list: List[str] = Field(default_factory=lambda: [
        "IC1: Studies focusing on the detection and classification of spam messages, scam messages (phishing/smishing), or fraud via conversational scripts.",
        "IC2: Papers that apply or evaluate Large Language Models (LLMs via prompting) or Pre-trained Language Models (PLMs like BERT, PhoBERT).",
        "IC3: Studies providing clear empirical results with metrics such as Accuracy, Precision, Recall, F1-score, inference latency, or computational cost.",
        "IC4: Papers discussing system architecture, integrating AI into real-world platforms (web/mobile apps), or community alert mechanisms (crowdsourcing/blacklist).",
        "IC5: Studies published from 2020 onwards."
    ])
    ec_list: List[str] = Field(default_factory=lambda: [
        "EC1: Studies focusing solely on malware analysis, or pure URL identification via hash algorithms without semantic text analysis.",
        "EC2: Papers dealing with acoustic voice/audio processing to detect fraudulent calls rather than processing text/scripts.",
        "EC3: Studies that do not utilize Machine Learning, LLMs, or PLMs (e.g., relying entirely on classical rule-based methods).",
        "EC4: Purely theoretical or vision papers lacking experimental datasets, practical implementations, or empirical evaluation.",
        "EC5: Papers not written in English, or where the full-text is inaccessible."
    ])
    paper_ids: Optional[List[str]] = None
    project_id: str = "default"

class MergeDuplicatesRequest(BaseModel):
    keep_id: str
    remove_id: str

class GitCommitRequest(BaseModel):
    repo_owner: str
    repo_name: str
    branch: str = "main"
    member_path: str = "trung_hieu/SLR/"
    commit_prefix: str = "[SLR]"
    github_token: str
    author_name: str = "Nguyen Trung Hieu"
    search_query: str = ""
    sources: List[str] = Field(default_factory=lambda: ["ArXiv", "OpenAlex", "Semantic Scholar"])
    project_id: str = "default"

class ExportRequest(BaseModel):
    author_name: str = "Nguyen Trung Hieu"
    search_query: str = ""
    sources: List[str] = Field(default_factory=lambda: ["ArXiv", "OpenAlex", "Semantic Scholar"])
    project_id: str = "default"

class ProtocolUpdateRequest(BaseModel):
    project_id: str = "default"
    pico: Dict[str, str] = Field(default_factory=dict)
    ic_list: List[str] = Field(default_factory=list)
    ec_list: List[str] = Field(default_factory=list)

class BulkUpdatePapersRequest(BaseModel):
    paper_ids: List[str]
    updates: PaperUpdate
    project_id: str = "default"

class BulkDeletePapersRequest(BaseModel):
    paper_ids: List[str]
    project_id: str = "default"

class CsvPaperImportItem(BaseModel):
    title: str
    authors: Optional[str] = "N/A"
    year: Optional[int] = None
    venue: Optional[str] = "N/A"
    abstract: Optional[str] = ""
    doi: Optional[str] = None
    url: Optional[str] = None
    source: Optional[str] = "CSV Import"
    citations_count: Optional[int] = 0

class CsvImportRequest(BaseModel):
    project_id: str = "default"
    source_label: Optional[str] = "CSV Import"
    papers: List[CsvPaperImportItem]

class SelectionCondition(BaseModel):
    field: str
    operator: str
    value: Optional[str] = ""

class SelectionRuleCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    match_mode: str = "AND"
    conditions: List[SelectionCondition] = Field(default_factory=list)
    default_ec_reason: Optional[str] = None
    project_id: str = "default"

class BulkFetchAbstractsRequest(BaseModel):
    paper_ids: List[str]
    project_id: str = "default"

class UpdateAbstractRequest(BaseModel):
    abstract: str
    project_id: str = "default"

class FetchMetadataRequest(BaseModel):
    identifier: str

class ManualPaperItem(BaseModel):
    title: str
    authors: Optional[str] = "Unknown Authors"
    year: Optional[int] = 2024
    venue: Optional[str] = ""
    abstract: Optional[str] = "N/A"
    doi: Optional[str] = ""
    url: Optional[str] = ""
    source: Optional[str] = "Manual Entry"
    citations_count: Optional[int] = 0
    status: Optional[str] = "PENDING"
    exclusion_reason: Optional[str] = None
    id: Optional[str] = None

class AddManualPaperRequest(BaseModel):
    project_id: str = "default"
    paper: ManualPaperItem

class ExtractEvidenceRequest(BaseModel):
    paper_id: Optional[str] = None
    title: str
    abstract: str
    authors: Optional[str] = ""
    year: Optional[int] = 2024
    venue: Optional[str] = ""
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    project_id: str = "default"

ManualPaperItem.model_rebuild()
AddManualPaperRequest.model_rebuild()
FetchMetadataRequest.model_rebuild()
ExtractEvidenceRequest.model_rebuild()




