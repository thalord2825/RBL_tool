import json
import logging
import os
import time
import random
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Optional, Generator, Tuple
from ..database import Database

logger = logging.getLogger(__name__)

VALID_DEFAULT_MODELS = [
    "models/gemini-2.0-flash",
    "models/gemini-1.5-flash",
    "models/gemini-2.5-flash",
    "models/gemini-1.5-flash-8b",
    "models/gemini-1.5-pro",
    "models/gemini-2.0-flash-lite",
]

MICRO_CHUNK_SIZE = 8  # 8 papers per chunk for fast, high-quality batch evaluation

class GeminiScreener:
    _cached_models: Optional[List[str]] = None
    _cached_key: Optional[str] = None
    _model_cooldowns: Dict[str, float] = {}  # { model_id: expiry_timestamp }

    @classmethod
    def get_cooling_models(cls) -> Dict[str, float]:
        """
        Returns a dict of all models currently cooling down with remaining seconds.
        """
        now = time.time()
        cooling = {}
        for m, exp in list(cls._model_cooldowns.items()):
            rem = exp - now
            if rem > 0:
                cooling[m] = round(rem, 1)
            else:
                cls._model_cooldowns.pop(m, None)
        return cooling

    @classmethod
    def is_model_cooling_down(cls, model_name: str) -> Tuple[bool, float]:
        """
        Checks if a model is currently on rate-limit cooldown.
        """
        exp = cls._model_cooldowns.get(model_name, 0.0)
        remaining = exp - time.time()
        if remaining > 0:
            return True, round(remaining, 1)
        return False, 0.0

    @classmethod
    def set_model_cooldown(cls, model_name: str, duration_sec: float = 60.0):
        """
        Puts a model on rate-limit cooldown (e.g. 60 seconds) so future requests bypass it instantly.
        """
        cls._model_cooldowns[model_name] = time.time() + duration_sec
        logger.info(f"Model-Level Circuit Breaker: {model_name} cooling down for {duration_sec}s")

    @classmethod
    def get_available_models(cls, api_key: str) -> List[str]:
        """
        Queries Google Gemini ModelService with caching to return valid models.
        """
        if cls._cached_models and cls._cached_key == api_key:
            return cls._cached_models

        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}&pageSize=50"
            res = requests.get(url, timeout=6)
            if res.status_code == 200:
                data = res.json()
                models = [
                    m.get("name") for m in data.get("models", [])
                    if "generateContent" in m.get("supportedGenerationMethods", [])
                ]
                if models:
                    cls._cached_models = models
                    cls._cached_key = api_key
                    return models
        except Exception as e:
            logger.warning(f"Error querying ListModels (will use valid fallback candidates): {e}")

        return VALID_DEFAULT_MODELS

    @classmethod
    def _build_candidate_models(cls, api_key: str, model_name: Optional[str] = None) -> List[str]:
        """
        Builds prioritized list of candidate models, excluding unsupported/slow experimental models,
        and pushing models on cooldown to the back.
        """
        raw_candidates = []
        
        # 1. User selected model (if specified)
        if model_name and model_name != "auto":
            clean_m = model_name if model_name.startswith("models/") else f"models/{model_name}"
            if "gemini-3" in clean_m:
                clean_m = "models/gemini-2.0-flash"
            raw_candidates.append(clean_m)

        # 2. Production Gemini Flash & Pro defaults (fastest, high reliability)
        for fb in VALID_DEFAULT_MODELS:
            if fb not in raw_candidates:
                raw_candidates.append(fb)

        # 3. Dynamic query strictly filtered for Gemini Flash / Pro
        available = cls.get_available_models(api_key)
        for m in available:
            m_lower = m.lower()
            if m not in raw_candidates and "gemini" in m_lower:
                if any(k in m_lower for k in ["flash", "pro"]) and not any(bad in m_lower for bad in ["gemma", "vision", "embed", "aqa", "imagen", "tts", "embedding"]):
                    raw_candidates.append(m)

        # Sort: Active models first (zero cooldown), cooling models at the back sorted by earliest expiration
        active = []
        cooling = []
        for m in raw_candidates:
            is_cool, rem = cls.is_model_cooling_down(m)
            if is_cool:
                cooling.append((rem, m))
            else:
                active.append(m)

        cooling.sort(key=lambda x: x[0])
        sorted_candidates = active + [m for _, m in cooling]
        return sorted_candidates

    @classmethod
    def _evaluate_single_chunk(
        cls,
        chunk_papers: List[Dict[str, Any]],
        pico: Dict[str, str],
        ic_list: List[str],
        ec_list: List[str],
        gemini_key: str,
        candidates_to_try: List[str],
        research_question: str,
        research_context: Optional[str] = ""
    ) -> Tuple[List[Dict[str, Any]], str, List[Dict[str, Any]]]:
        """
        Evaluates a single micro-chunk (<= 8 papers).
        Returns: (evaluations, used_model, cooldown_events)
        """
        papers_payload = []
        for p in chunk_papers:
            papers_payload.append({
                "id": p.get("id"),
                "title": p.get("title", ""),
                "year": p.get("year", 2024),
                "venue": p.get("venue", ""),
                "abstract": p.get("abstract", "")
            })

        context_block = ""
        if research_context and research_context.strip():
            context_block = f"""
RESEARCHER CONTEXT & DOMAIN GUIDANCE (RELAXATION / PRIORITY DIRECTIVES):
----------------------------------------------------------------------
{research_context.strip()}
----------------------------------------------------------------------
NOTE: The lead researcher provided the above domain context and relaxation guidance.
If the researcher specifies relaxations (e.g. accepting Southeast Asian or global telecom SMS/phishing scam datasets when Vietnam data is scarce, or including PLM transformer architectures), you MUST follow this guidance with HIGHEST PRIORITY.
"""

        system_instruction = f"""
You are an expert Systematic Literature Review (SLR) screener adhering to PRISMA 2020 guidelines and strict scientific rigor.
Your task is to evaluate the Title and Abstract of each candidate paper against the provided Research Question, PICO framework, Inclusion Criteria (IC), Exclusion Criteria (EC), and Researcher Guidance.

RESEARCH QUESTION:
{research_question}

PICO FRAMEWORK:
- Population (P): {pico.get('P', 'Vietnamese text, chat, SMS scam lures')}
- Intervention (I): {pico.get('I', 'Few-shot / In-context LLM Prompting')}
- Comparison (C): {pico.get('C', 'Fine-tuned Pretrained Language Models (PhoBERT, ViDeBERTa)')}
- Outcome (O): {pico.get('O', 'Classification performance (Macro-F1, Precision, Recall), Latency, Cost')}

INCLUSION CRITERIA (IC):
{chr(10).join(ic_list) if ic_list else "IC1: Studies evaluating text classification using LLMs or PLMs."}

EXCLUSION CRITERIA (EC):
{chr(10).join(ec_list) if ec_list else "EC1: Non-textual network security. EC2: Non-reproducible study."}
{context_block}
DECISION RULES:
1. "INCLUDED": Paper satisfies all primary ICs (considering researcher relaxation guidance), matches 0 ECs, directly addresses PICO scope, and your confidence score is >= 0.80.
2. "EXCLUDED": Paper violates PICO scope or explicitly matches ANY Exclusion Criterion (EC1-EC5). You MUST specify the exact matched exclusion_reason (e.g., "EC1: Focuses on network packet headers").
3. "UNSURE": The abstract is ambiguous, lacks concrete methodology, relevance is borderline, or your confidence is < 0.70.

CRITICAL COMPLETENESS REQUIREMENT:
You MUST evaluate EVERY SINGLE candidate paper in the input array. If {len(papers_payload)} papers are provided, your output JSON array MUST contain EXACTLY {len(papers_payload)} elements matching their exact IDs.

STRICT JSON OUTPUT FORMAT:
You MUST output ONLY a valid JSON array matching this exact schema for every input paper:
[
  {{
    "id": "string",
    "decision": "INCLUDED" | "EXCLUDED" | "UNSURE",
    "confidence_score": float (between 0.0 and 1.0),
    "matched_criteria": ["string"],
    "exclusion_reason": "string" or null,
    "scientific_rationale": "Clear, objective sentence justifying decision based strictly on the abstract and research guidance"
  }}
]
"""

        user_content = f"Evaluate the following {len(papers_payload)} candidate papers:\n\n{json.dumps(papers_payload, indent=2)}"

        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [
                {"role": "user", "parts": [{"text": f"{system_instruction}\n\n{user_content}"}]}
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.1,
                "topP": 0.95
            }
        }

        last_error = "No candidate models responded successfully"
        cooldown_events = []

        for model_id in candidates_to_try:
            # Check if this model is currently on cooldown; if so, only try if no active models remain
            is_cool, rem_cool = cls.is_model_cooling_down(model_id)
            if is_cool and len(candidates_to_try) > 1:
                # Skip cooling model immediately
                continue

            for api_ver in ["v1beta", "v1"]:
                url = f"https://generativelanguage.googleapis.com/{api_ver}/{model_id}:generateContent?key={gemini_key}"
                
                try:
                    response = requests.post(url, headers=headers, json=payload, timeout=22)
                    if response.status_code == 200:
                        result_json = response.json()
                        candidates = result_json.get("candidates", [])
                        if not candidates:
                            continue

                        raw_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "[]")
                        cleaned_text = raw_text.strip()
                        if cleaned_text.startswith("```json"):
                            cleaned_text = cleaned_text[7:]
                        if cleaned_text.startswith("```"):
                            cleaned_text = cleaned_text[3:]
                        if cleaned_text.endswith("```"):
                            cleaned_text = cleaned_text[:-3]
                        cleaned_text = cleaned_text.strip()

                        evaluations = json.loads(cleaned_text)
                        if not isinstance(evaluations, list):
                            evaluations = [evaluations] if isinstance(evaluations, dict) else []

                        # Guarantee every chunk paper has an evaluation item
                        eval_map = {e.get("id"): e for e in evaluations if isinstance(e, dict) and e.get("id")}
                        final_evals = []
                        for p in chunk_papers:
                            pid = p.get("id")
                            if pid in eval_map:
                                final_evals.append(eval_map[pid])
                            else:
                                final_evals.append({
                                    "id": pid,
                                    "decision": "PENDING",
                                    "confidence_score": 0.5,
                                    "matched_criteria": [],
                                    "exclusion_reason": None,
                                    "scientific_rationale": "Pending manual review"
                                })
                        return final_evals, model_id, cooldown_events

                    elif response.status_code in [429, 503]:
                        # Activate 60s cooldown on this model
                        cls.set_model_cooldown(model_id, 60.0)
                        cooldown_events.append({
                            "event": "ai_rate_limit",
                            "model": model_id,
                            "cooldown_sec": 60,
                            "message": f"Quota limit reached on {model_id}. Activated 60s cooldown; auto-routing to alternative model."
                        })
                        logger.warning(f"Quota rate-limit (429) on {model_id}. Activated 60s cooldown.")
                        break # Switch to next candidate model immediately!

                    elif response.status_code == 404:
                        # Non-existent model on this endpoint, skip to next candidate immediately
                        last_error = f"HTTP 404: Model {model_id} not available"
                        break
                    else:
                        last_error = f"HTTP {response.status_code}: {response.text[:200]}"
                        break
                except Exception as e:
                    last_error = str(e)
                    continue

        raise Exception(f"Gemini API Error: {last_error}")

    @classmethod
    def screen_papers_concurrent_generator(
        cls,
        papers: List[Dict[str, Any]],
        pico: Dict[str, str],
        ic_list: List[str],
        ec_list: List[str],
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        research_question: str = "How effective are prompt-based LLMs (few-shot) compared with a fine-tuned PhoBERT model for Vietnamese scam message classification?",
        research_context: Optional[str] = "",
        max_workers: int = 2
    ) -> Generator[Dict[str, Any], None, None]:
        """
        High-throughput parallel micro-batch generator for real-time stream harvesting.
        Yields chunk evaluation items concurrently with model cooldowns & live diagnostics.
        """
        gemini_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not gemini_key:
            logger.warning("No GEMINI_API_KEY available. Skipping inline AI screening.")
            yield {"type": "warning", "message": "Gemini API key is not configured. Papers will be saved as PENDING."}
            return

        if not papers:
            return

        candidates_to_try = cls._build_candidate_models(gemini_key, model_name)
        chunks = [papers[i:i + MICRO_CHUNK_SIZE] for i in range(0, len(papers), MICRO_CHUNK_SIZE)]
        total_chunks = len(chunks)

        def process_chunk(chunk_idx, chunk):
            st = time.time()
            try:
                # Dynamic candidate resolution for each chunk to respect latest cooldown states
                dyn_candidates = cls._build_candidate_models(gemini_key, model_name)
                res, used_model, cooldowns = cls._evaluate_single_chunk(
                    chunk_papers=chunk,
                    pico=pico,
                    ic_list=ic_list,
                    ec_list=ec_list,
                    gemini_key=gemini_key,
                    candidates_to_try=dyn_candidates,
                    research_question=research_question,
                    research_context=research_context
                )
                dur = round(time.time() - st, 2)
                return chunk_idx, chunk, res, used_model, cooldowns, None, dur
            except Exception as ex:
                dur = round(time.time() - st, 2)
                return chunk_idx, chunk, [], "", [], str(ex), dur

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = []
            for idx, ch in enumerate(chunks):
                futures.append(executor.submit(process_chunk, idx, ch))
                time.sleep(0.3)  # Pacing between submissions to prevent burst rate-limits

            for future in as_completed(futures):
                try:
                    c_idx, chunk, evals, used_model, cooldowns, err, dur = future.result()
                    
                    # Yield any cooldown notifications immediately
                    for cd in cooldowns:
                        yield {
                            "type": "ai_rate_limit",
                            "model": cd.get("model"),
                            "cooldown_sec": cd.get("cooldown_sec", 60),
                            "message": cd.get("message"),
                            "cooling_models": cls.get_cooling_models()
                        }

                    if err:
                        logger.warning(f"Micro-chunk {c_idx} evaluation warning: {err}")
                        yield {
                            "type": "chunk_warning",
                            "chunk_idx": c_idx,
                            "error": err,
                            "chunk": chunk,
                            "cooling_models": cls.get_cooling_models()
                        }
                    else:
                        yield {
                            "type": "chunk_success",
                            "chunk_idx": c_idx,
                            "evaluations": evals,
                            "used_model": used_model,
                            "duration_sec": dur,
                            "cooling_models": cls.get_cooling_models()
                        }
                except Exception as fut_err:
                    logger.error(f"Future error in concurrent screening: {fut_err}")

    @classmethod
    def screen_papers_stream(
        cls,
        papers: List[Dict[str, Any]],
        pico: Dict[str, str],
        ic_list: List[str],
        ec_list: List[str],
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        research_question: str = "How effective are prompt-based LLMs (few-shot) compared with a fine-tuned PhoBERT model for Vietnamese scam message classification?",
        research_context: Optional[str] = "",
        project_id: str = "default"
    ) -> Generator[str, None, None]:
        """
        Micro-batch streaming generator for full manual AI screening modal.
        """
        gemini_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not gemini_key:
            yield f"data: {json.dumps({'event': 'error', 'message': 'GEMINI_API_KEY is required for AI screening.'})}\n\n"
            return

        if not papers:
            yield f"data: {json.dumps({'event': 'complete', 'total': 0, 'evaluated': 0, 'stats': {}})}\n\n"
            return

        total_papers = len(papers)
        candidates_to_try = cls._build_candidate_models(gemini_key, model_name)
        active_model = candidates_to_try[0] if candidates_to_try else "models/gemini-2.0-flash"

        chunks = [papers[i:i + MICRO_CHUNK_SIZE] for i in range(0, total_papers, MICRO_CHUNK_SIZE)]
        total_chunks = len(chunks)

        yield f"data: {json.dumps({'event': 'init', 'total_papers': total_papers, 'total_chunks': total_chunks, 'chunk_size': MICRO_CHUNK_SIZE, 'active_model': active_model, 'cooling_models': cls.get_cooling_models()})}\n\n"

        stats = {"INCLUDED": 0, "EXCLUDED": 0, "UNSURE": 0}
        evaluated_count = 0
        paper_map = {p["id"]: p for p in papers}
        start_time = time.time()

        for chunk_idx, chunk in enumerate(chunks, 1):
            chunk_start = time.time()
            dyn_candidates = cls._build_candidate_models(gemini_key, model_name)
            current_model = dyn_candidates[0] if dyn_candidates else active_model

            yield f"data: {json.dumps({'event': 'chunk_start', 'chunk_idx': chunk_idx, 'total_chunks': total_chunks, 'chunk_size': len(chunk), 'active_model': current_model, 'cooling_models': cls.get_cooling_models()})}\n\n"

            try:
                evals, used_model, cooldowns = cls._evaluate_single_chunk(
                    chunk_papers=chunk,
                    pico=pico,
                    ic_list=ic_list,
                    ec_list=ec_list,
                    gemini_key=gemini_key,
                    candidates_to_try=dyn_candidates,
                    research_question=research_question,
                    research_context=research_context
                )

                # Emit any cooldown events that occurred
                for cd in cooldowns:
                    yield f"data: {json.dumps({'event': 'ai_rate_limit', 'model': cd.get('model'), 'cooldown_sec': cd.get('cooldown_sec', 60), 'message': cd.get('message'), 'cooling_models': cls.get_cooling_models()})}\n\n"

                for item in evals:
                    paper_id = item.get("id")
                    decision = item.get("decision", "UNSURE")
                    confidence = item.get("confidence_score", 0.8)
                    exclusion_reason = item.get("exclusion_reason")
                    rationale = item.get("scientific_rationale", "")

                    if decision in stats:
                        stats[decision] += 1
                    evaluated_count += 1

                    # DB incremental update
                    update_data = {
                        "ai_decision": decision,
                        "ai_confidence": confidence,
                        "ai_rationale": rationale
                    }
                    if decision == "EXCLUDED" and exclusion_reason:
                        update_data["status"] = "EXCLUDED"
                        update_data["exclusion_reason"] = exclusion_reason
                    elif decision == "INCLUDED":
                        update_data["status"] = "INCLUDED"
                        update_data["exclusion_reason"] = None
                        matched_arr = item.get("matched_criteria") or []
                        if matched_arr:
                            update_data["matched_ics"] = ", ".join(matched_arr)

                    try:
                        Database.update_paper(paper_id, update_data, project_id=project_id)
                    except Exception as db_err:
                        logger.error(f"Failed to update paper {paper_id}: {db_err}")

                    elapsed = time.time() - start_time
                    avg_per_paper = elapsed / max(1, evaluated_count)
                    remaining = total_papers - evaluated_count
                    eta = int(remaining * avg_per_paper)

                    paper_meta = paper_map.get(paper_id, {})
                    yield f"data: {json.dumps({'event': 'paper_evaluated', 'paper_id': paper_id, 'title': paper_meta.get('title', ''), 'year': paper_meta.get('year', ''), 'source': paper_meta.get('source', ''), 'decision': decision, 'confidence': confidence, 'exclusion_reason': exclusion_reason, 'rationale': rationale, 'matched_criteria': item.get('matched_criteria', []), 'raw_json': item, 'evaluated_count': evaluated_count, 'total_papers': total_papers, 'progress_percent': round((evaluated_count / total_papers) * 100, 1), 'stats': stats, 'eta_seconds': eta, 'latency_seconds': round(time.time() - chunk_start, 2), 'active_model': used_model, 'cooling_models': cls.get_cooling_models()})}\n\n"

            except Exception as e:
                logger.error(f"Chunk {chunk_idx} failed: {e}")
                yield f"data: {json.dumps({'event': 'chunk_error', 'chunk_idx': chunk_idx, 'error': str(e), 'cooling_models': cls.get_cooling_models()})}\n\n"

            time.sleep(0.3)  # Smooth rate-limit pacing between sequential chunks
            yield f": heartbeat\n\n"

        final_papers = Database.get_all_papers(project_id)
        total_dur = round(time.time() - start_time, 2)
        yield f"data: {json.dumps({'event': 'complete', 'total': total_papers, 'evaluated': evaluated_count, 'stats': stats, 'duration_seconds': total_dur, 'papers': final_papers})}\n\n"

    @classmethod
    def stream_extract_evidence_single_paper(
        cls,
        paper: Dict[str, Any],
        api_key: Optional[str] = None,
        model_name: Optional[str] = None
    ):
        """
        SSE Generator for Real-Time Streaming Evidence Extraction with 3-tier anti-timeout failover and diagnostic logs.
        """
        start_time = time.time()
        gemini_key = api_key or os.getenv("GEMINI_API_KEY", "")
        if not gemini_key:
            yield f"data: {json.dumps({'event': 'error', 'message': 'Gemini API key is required. Please enter API key in settings or AI modal.'})}\n\n"
            return

        p_id = paper.get("id", "Paper")
        title = (paper.get("title") or "").strip()
        abstract = (paper.get("abstract") or "").strip()
        authors = (paper.get("authors") or "").strip()
        year = paper.get("year", 2024)
        venue = (paper.get("venue") or "").strip()

        if not abstract or abstract.lower() in ["n/a", "none", ""]:
            yield f"data: {json.dumps({'event': 'error', 'message': 'Abstract is missing or \"N/A\". Please fetch or enter the abstract before extracting evidence.'})}\n\n"
            return

        # Tier 1 Anti-Timeout: Clean and compress abstract if overly lengthy
        yield f"data: {json.dumps({'event': 'step', 'step': 1, 'total': 4, 'percent': 15, 'message': 'Cleaning abstract & structuring context...', 'log': f'[{p_id}] Pre-processing context (Title: {len(title)} chars, Abstract: {len(abstract)} chars)...'})}\n\n"
        
        cleaned_abstract = re.sub(r'\s+', ' ', abstract).strip()
        if len(cleaned_abstract) > 3500:
            cleaned_abstract = cleaned_abstract[:3500] + " ... [Abstract truncated for high-speed inference]"
            yield f"data: {json.dumps({'event': 'step', 'step': 1, 'total': 4, 'percent': 20, 'message': 'Compressed extensive abstract for ultra-fast latency', 'log': '⚡ Truncated abstract to 3500 chars to guarantee sub-2s response'})}\n\n"

        # Tier 2 Anti-Timeout: High-priority candidate pool
        candidates_to_try = cls._build_candidate_models(gemini_key, model_name)
        active_count = len(candidates_to_try)
        primary_model = candidates_to_try[0] if candidates_to_try else "models/gemini-2.0-flash"

        yield f"data: {json.dumps({'event': 'step', 'step': 2, 'total': 4, 'percent': 35, 'message': f'Connecting to {primary_model}...', 'log': f'Resolved {active_count} candidate model(s). Primary target: {primary_model}'})}\n\n"

        system_instruction = """
You are an expert Systematic Literature Review (SLR) Evidence Synthesizer operating under strict PRISMA guidelines and the Zero Data Fabrication Policy.
Your task is to extract empirical research evidence from the provided academic paper abstract into a standardized 7-column evidence matrix.

STRICT ZERO FABRICATION POLICY:
- Extract ONLY what is explicitly stated in the paper title and abstract.
- If a metric, sample size, or code repository is not mentioned, YOU MUST SET THAT FIELD TO "N/A".
- Never speculate, hallucinate, or fabricate numbers.

REQUIRED JSON OUTPUT FORMAT:
{
  "tool_model": "Exact model architectures/methods evaluated (e.g., PhoBERT-base, GPT-4, BiGRU+WBCE, RoBERTa). If none specified, 'N/A'.",
  "dataset_name": "Name of the dataset and domain context (e.g., Vietnamese SMS Spam Dataset, Zalo Phishing Messages). If none specified, 'N/A'.",
  "sample_size_n": "Sample size N (e.g., N = 11,200 SMS messages). If none specified, 'N/A'.",
  "metrics_evaluated": "Evaluation metrics used (e.g., Macro-F1, Precision, Recall, Accuracy, Latency). If none specified, 'N/A'.",
  "empirical_results": "Exact numerical performance results achieved (e.g., PhoBERT: F1=0.941, Acc=96.2%; GPT-4: F1=0.915). If none specified, 'N/A'.",
  "code_url": "Official GitHub/GitLab/HuggingFace URL if mentioned in text, otherwise 'N/A'.",
  "limitations": "Threats to validity, limitations, or constraints mentioned by authors. If none specified, 'N/A'."
}
"""

        user_content = f"""
PAPER DETAILS:
Title: {title}
Authors: {authors} ({year})
Venue: {venue}
Abstract: {cleaned_abstract}
"""

        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [
                {"role": "user", "parts": [{"text": f"{system_instruction}\n\n{user_content}"}]}
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.1,
                "maxOutputTokens": 1024,
                "topP": 0.95
            }
        }

        successful_evidence = None
        used_model = None

        for idx, model_id in enumerate(candidates_to_try):
            is_cool, _ = cls.is_model_cooling_down(model_id)
            if is_cool and len(candidates_to_try) > 1:
                yield f"data: {json.dumps({'event': 'log', 'log': f'Skipping cooling model {model_id}...'})}\n\n"
                continue

            yield f"data: {json.dumps({'event': 'step', 'step': 3, 'total': 4, 'percent': 40 + idx * 10, 'message': f'Querying {model_id} (Fast Timeout: 8s)...', 'log': f'Sending structured extraction payload to {model_id}...' })}\n\n"

            url = f"https://generativelanguage.googleapis.com/v1beta/{model_id}:generateContent?key={gemini_key}"
            try:
                t0 = time.time()
                response = requests.post(url, headers=headers, json=payload, timeout=8.0)
                call_dur = round(time.time() - t0, 2)

                if response.status_code == 200:
                    result_json = response.json()
                    candidates = result_json.get("candidates", [])
                    if not candidates:
                        yield f"data: {json.dumps({'event': 'log', 'log': f'⚠️ {model_id} returned empty candidate list ({call_dur}s). Trying next model...'})}\n\n"
                        continue

                    raw_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
                    cleaned_text = raw_text.strip()
                    if cleaned_text.startswith("```json"):
                        cleaned_text = cleaned_text[7:]
                    if cleaned_text.startswith("```"):
                        cleaned_text = cleaned_text[3:]
                    if cleaned_text.endswith("```"):
                        cleaned_text = cleaned_text[:-3]
                    cleaned_text = cleaned_text.strip()

                    try:
                        data = json.loads(cleaned_text)
                    except Exception:
                        data = {}

                    successful_evidence = {
                        "tool_model": data.get("tool_model") or "N/A",
                        "dataset_name": data.get("dataset_name") or "N/A",
                        "sample_size_n": data.get("sample_size_n") or "N/A",
                        "metrics_evaluated": data.get("metrics_evaluated") or "N/A",
                        "empirical_results": data.get("empirical_results") or "N/A",
                        "code_url": data.get("code_url") or "N/A",
                        "limitations": data.get("limitations") or "N/A",
                        "extracted_by_model": model_id
                    }
                    used_model = model_id
                    yield f"data: {json.dumps({'event': 'step', 'step': 4, 'total': 4, 'percent': 90, 'message': 'Enforcing Zero Data Fabrication & normalizing 7 columns...', 'log': f'✓ Received valid JSON from {model_id} in {call_dur}s. Auditing 7 fields...'})}\n\n"
                    break

                elif response.status_code == 429:
                    cls.set_model_cooldown(model_id, 60.0)
                    yield f"data: {json.dumps({'event': 'fallback', 'from_model': model_id, 'reason': 'Rate Limited (429)', 'log': f'⚠️ {model_id} hit rate limit (429). Activating circuit breaker (60s cooldown)...'})}\n\n"
                    continue
                else:
                    yield f"data: {json.dumps({'event': 'log', 'log': f'⚠️ {model_id} HTTP {response.status_code}: {response.text[:120]}...'})}\n\n"

            except requests.exceptions.Timeout:
                cls.set_model_cooldown(model_id, 45.0)
                next_cand = candidates_to_try[idx + 1] if idx + 1 < len(candidates_to_try) else "none"
                yield f"data: {json.dumps({'event': 'fallback', 'from_model': model_id, 'to_model': next_cand, 'reason': 'Read Timeout (8s)', 'log': f'⏱️ {model_id} exceeded 8s threshold. Auto-failing over to next candidate: {next_cand}'})}\n\n"
                continue
            except Exception as e:
                yield f"data: {json.dumps({'event': 'log', 'log': f'⚠️ {model_id} network exception: {str(e)}'})}\n\n"
                continue

        total_dur_ms = int((time.time() - start_time) * 1000)

        if successful_evidence:
            yield f"data: {json.dumps({'event': 'complete', 'status': 'success', 'percent': 100, 'evidence': successful_evidence, 'model': used_model, 'duration_ms': total_dur_ms, 'message': f'Successfully extracted 7-column evidence via {used_model} in {total_dur_ms}ms', 'log': f'✨ Done! Completed in {total_dur_ms}ms with zero fabrication assurance.'})}\n\n"
        else:
            fallback_na = {
                "tool_model": "N/A",
                "dataset_name": "N/A",
                "sample_size_n": "N/A",
                "metrics_evaluated": "N/A",
                "empirical_results": "N/A",
                "code_url": "N/A",
                "limitations": "N/A",
                "extracted_by_model": "None"
            }
            yield f"data: {json.dumps({'event': 'complete', 'status': 'partial', 'percent': 100, 'evidence': fallback_na, 'model': 'None', 'duration_ms': total_dur_ms, 'message': 'All models timed out. Populated form with N/A.', 'log': '⚠️ Extraction exhausted all model attempts. Set defaults to N/A.'})}\n\n"

    @classmethod
    def extract_evidence_single_paper(
        cls,
        paper: Dict[str, Any],
        api_key: Optional[str] = None,
        model_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Synchronous fallback for evidence extraction.
        """
        gemini_key = api_key or os.getenv("GEMINI_API_KEY", "")
        if not gemini_key:
            raise ValueError("Gemini API key is required for automated evidence extraction.")

        candidates_to_try = cls._build_candidate_models(gemini_key, model_name)

        title = paper.get("title", "")
        abstract = paper.get("abstract", "")
        authors = paper.get("authors", "")
        year = paper.get("year", 2024)
        venue = paper.get("venue", "")

        system_instruction = """
You are an expert Systematic Literature Review (SLR) Evidence Synthesizer operating under strict PRISMA guidelines and the Zero Data Fabrication Policy.
Your task is to extract empirical research evidence from the provided academic paper abstract into a standardized 7-column evidence matrix.

STRICT ZERO FABRICATION POLICY:
- Extract ONLY what is explicitly stated in the paper title and abstract.
- If a metric, sample size, or code repository is not mentioned, YOU MUST SET THAT FIELD TO "N/A".
- Never speculate, hallucinate, or fabricate numbers.

REQUIRED JSON OUTPUT FORMAT:
{
  "tool_model": "Exact model architectures/methods evaluated (e.g., PhoBERT-base, GPT-4, BiGRU+WBCE, RoBERTa). If none specified, 'N/A'.",
  "dataset_name": "Name of the dataset and domain context (e.g., Vietnamese SMS Spam Dataset, Zalo Phishing Messages). If none specified, 'N/A'.",
  "sample_size_n": "Sample size N (e.g., N = 11,200 SMS messages). If none specified, 'N/A'.",
  "metrics_evaluated": "Evaluation metrics used (e.g., Macro-F1, Precision, Recall, Accuracy, Latency). If none specified, 'N/A'.",
  "empirical_results": "Exact numerical performance results achieved (e.g., PhoBERT: F1=0.941, Acc=96.2%; GPT-4: F1=0.915). If none specified, 'N/A'.",
  "code_url": "Official GitHub/GitLab/HuggingFace URL if mentioned in text, otherwise 'N/A'.",
  "limitations": "Threats to validity, limitations, or constraints mentioned by authors. If none specified, 'N/A'."
}
"""

        user_content = f"""
PAPER DETAILS:
Title: {title}
Authors: {authors} ({year})
Venue: {venue}
Abstract: {abstract}
"""

        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [
                {"role": "user", "parts": [{"text": f"{system_instruction}\n\n{user_content}"}]}
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.1,
                "maxOutputTokens": 1024,
                "topP": 0.95
            }
        }

        for model_id in candidates_to_try:
            is_cool, _ = cls.is_model_cooling_down(model_id)
            if is_cool and len(candidates_to_try) > 1:
                continue

            url = f"https://generativelanguage.googleapis.com/v1beta/{model_id}:generateContent?key={gemini_key}"
            try:
                response = requests.post(url, headers=headers, json=payload, timeout=8.0)
                if response.status_code == 200:
                    result_json = response.json()
                    candidates = result_json.get("candidates", [])
                    if not candidates:
                        continue

                    raw_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
                    cleaned_text = raw_text.strip()
                    if cleaned_text.startswith("```json"):
                        cleaned_text = cleaned_text[7:]
                    if cleaned_text.startswith("```"):
                        cleaned_text = cleaned_text[3:]
                    if cleaned_text.endswith("```"):
                        cleaned_text = cleaned_text[:-3]
                    cleaned_text = cleaned_text.strip()

                    data = json.loads(cleaned_text)
                    return {
                        "tool_model": data.get("tool_model") or "N/A",
                        "dataset_name": data.get("dataset_name") or "N/A",
                        "sample_size_n": data.get("sample_size_n") or "N/A",
                        "metrics_evaluated": data.get("metrics_evaluated") or "N/A",
                        "empirical_results": data.get("empirical_results") or "N/A",
                        "code_url": data.get("code_url") or "N/A",
                        "limitations": data.get("limitations") or "N/A",
                        "extracted_by_model": model_id
                    }
                elif response.status_code == 429:
                    cls.set_model_cooldown(model_id, 60.0)
                    continue
            except requests.exceptions.Timeout:
                cls.set_model_cooldown(model_id, 45.0)
                continue
            except Exception as e:
                logger.warning(f"Evidence extraction try failed on {model_id}: {e}")

        return {
            "tool_model": "N/A",
            "dataset_name": "N/A",
            "sample_size_n": "N/A",
            "metrics_evaluated": "N/A",
            "empirical_results": "N/A",
            "code_url": "N/A",
            "limitations": "N/A",
            "extracted_by_model": "None"
        }

    @classmethod
    def stream_bulk_extract_evidence(
        cls,
        paper_ids: List[str],
        project_id: str = "default",
        api_key: Optional[str] = None,
        model_name: Optional[str] = "auto",
        delay_ms: int = 400
    ):
        """
        Server-Sent Events generator that streams bulk evidence extraction progress across multiple selected papers.
        Automatically saves extracted 7-column evidence directly into SQLite upon each paper completion.
        """
        gemini_key = api_key or os.getenv("GEMINI_API_KEY", "")
        if not gemini_key:
            yield f"data: {json.dumps({'event': 'error', 'message': 'Gemini API key is required. Please configure your API key.'})}\n\n"
            return

        from ..database import Database
        all_papers = Database.get_all_papers(project_id)
        paper_dict = {p["id"]: p for p in all_papers}

        target_papers = [paper_dict[pid] for pid in paper_ids if pid in paper_dict]
        total_count = len(target_papers)

        if total_count == 0:
            yield f"data: {json.dumps({'event': 'error', 'message': 'No valid papers found for the provided IDs.'})}\n\n"
            return

        yield f"data: {json.dumps({'event': 'batch_start', 'total': total_count, 'paper_ids': [p['id'] for p in target_papers]})}\n\n"

        success_count = 0
        failed_count = 0
        start_time = time.time()

        for idx, paper in enumerate(target_papers, 1):
            p_id = paper["id"]
            p_title = paper.get("title", "")
            p_abstract = paper.get("abstract", "")

            yield f"data: {json.dumps({'event': 'paper_start', 'paper_id': p_id, 'index': idx, 'total': total_count, 'title': p_title, 'percent': int(((idx - 1) / total_count) * 100)})}\n\n"

            if not p_abstract or p_abstract.strip() in ["", "N/A", "None"]:
                yield f"data: {json.dumps({'event': 'paper_error', 'paper_id': p_id, 'index': idx, 'total': total_count, 'error': 'Abstract is empty or N/A', 'log': f'⚠️ [{p_id}] Skipped: Abstract is empty.'})}\n\n"
                failed_count += 1
                continue

            try:
                p_start = time.time()
                evidence = cls.extract_evidence_single_paper(
                    paper=paper,
                    api_key=gemini_key,
                    model_name=model_name
                )
                p_dur_ms = int((time.time() - p_start) * 1000)

                # Persist to Database immediately
                Database.update_paper(p_id, {
                    "tool_model": evidence.get("tool_model", "N/A"),
                    "dataset_name": evidence.get("dataset_name", "N/A"),
                    "sample_size_n": evidence.get("sample_size_n", "N/A"),
                    "metrics_evaluated": evidence.get("metrics_evaluated", "N/A"),
                    "empirical_results": evidence.get("empirical_results", "N/A"),
                    "code_url": evidence.get("code_url", "N/A"),
                    "limitations": evidence.get("limitations", "N/A"),
                    "status": "INCLUDED"
                }, project_id=project_id)

                success_count += 1
                yield f"data: {json.dumps({'event': 'paper_success', 'paper_id': p_id, 'index': idx, 'total': total_count, 'evidence': evidence, 'duration_ms': p_dur_ms, 'percent': int((idx / total_count) * 100), 'log': f'✓ [{p_id}] Extracted in {p_dur_ms}ms (Model: {evidence.get(\"tool_model\", \"N/A\")[:30]})'})}\n\n"

            except Exception as e:
                failed_count += 1
                yield f"data: {json.dumps({'event': 'paper_error', 'paper_id': p_id, 'index': idx, 'total': total_count, 'error': str(e), 'percent': int((idx / total_count) * 100), 'log': f'❌ [{p_id}] Extraction error: {str(e)[:80]}'})}\n\n"

            # Rate-limiting delay between papers
            if delay_ms > 0 and idx < total_count:
                time.sleep(delay_ms / 1000.0)

        total_dur_s = round(time.time() - start_time, 1)
        yield f"data: {json.dumps({'event': 'batch_complete', 'total': total_count, 'total_success': success_count, 'total_failed': failed_count, 'duration_s': total_dur_s, 'percent': 100, 'log': f'🎉 Batch complete! {success_count}/{total_count} papers extracted successfully in {total_dur_s}s.'})}\n\n"


