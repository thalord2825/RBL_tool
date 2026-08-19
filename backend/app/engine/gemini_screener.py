import json
import logging
import os
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Optional, Generator
from ..database import Database

logger = logging.getLogger(__name__)

DEFAULT_FALLBACKS = [
    "models/gemini-2.5-flash",
    "models/gemini-flash-latest",
    "models/gemini-2.5-flash-lite",
    "models/gemini-2.5-pro",
    "models/gemini-3-flash",
]

MICRO_CHUNK_SIZE = 6  # 6 papers per micro-chunk for ultra-fast parallel throughput

class GeminiScreener:
    _cached_models: Optional[List[str]] = None
    _cached_key: Optional[str] = None

    @classmethod
    def get_available_models(cls, api_key: str) -> List[str]:
        """
        Queries Google Gemini ModelService with caching to prevent redundant HTTP requests.
        """
        if cls._cached_models and cls._cached_key == api_key:
            return cls._cached_models

        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}&pageSize=50"
            res = requests.get(url, timeout=5)
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
            logger.warning(f"Error querying ListModels (will use default candidates): {e}")

        return DEFAULT_FALLBACKS

    @classmethod
    def _build_candidate_models(cls, api_key: str, model_name: Optional[str] = None) -> List[str]:
        candidates = []
        if model_name and model_name != "auto":
            clean_m = model_name if model_name.startswith("models/") else f"models/{model_name}"
            candidates.append(clean_m)

        for fb in DEFAULT_FALLBACKS:
            if fb not in candidates:
                candidates.append(fb)

        return candidates

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
    ) -> List[Dict[str, Any]]:
        """
        Evaluates a single micro-chunk (<= 6 papers) with fast timeout (15s).
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

        for model_id in candidates_to_try:
            for api_ver in ["v1beta", "v1"]:
                url = f"https://generativelanguage.googleapis.com/{api_ver}/{model_id}:generateContent?key={gemini_key}"
                
                for attempt in range(3):
                    try:
                        response = requests.post(url, headers=headers, json=payload, timeout=20)
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
                                    # Fallback item if Gemini skipped this ID
                                    final_evals.append({
                                        "id": pid,
                                        "decision": "PENDING",
                                        "confidence_score": 0.5,
                                        "matched_criteria": [],
                                        "exclusion_reason": None,
                                        "scientific_rationale": "Pending manual / deep batch review"
                                    })
                            return final_evals

                        elif response.status_code in [429, 503]:
                            logger.warning(f"Gemini API rate limited (attempt {attempt+1}/3), backing off...")
                            time.sleep(1.2 * (attempt + 1))
                            continue
                        else:
                            last_error = f"HTTP {response.status_code}: {response.text[:200]}"
                            break
                    except Exception as e:
                        last_error = str(e)
                        time.sleep(1.0)
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
        Yields chunk evaluation items concurrently as they finish with rate-limit pacing.
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

        def process_chunk(chunk_idx, chunk):
            st = time.time()
            try:
                res = cls._evaluate_single_chunk(
                    chunk_papers=chunk,
                    pico=pico,
                    ic_list=ic_list,
                    ec_list=ec_list,
                    gemini_key=gemini_key,
                    candidates_to_try=candidates_to_try,
                    research_question=research_question,
                    research_context=research_context
                )
                dur = round(time.time() - st, 2)
                return chunk_idx, chunk, res, None, dur
            except Exception as ex:
                dur = round(time.time() - st, 2)
                return chunk_idx, chunk, [], str(ex), dur

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = []
            for idx, ch in enumerate(chunks):
                futures.append(executor.submit(process_chunk, idx, ch))
                time.sleep(0.2)  # Pacing between submissions to prevent burst rate-limits

            for future in as_completed(futures):
                try:
                    c_idx, chunk, evals, err, dur = future.result()
                    if err:
                        logger.warning(f"Micro-chunk {c_idx} evaluation warning: {err}")
                        yield {
                            "type": "chunk_warning",
                            "chunk_idx": c_idx,
                            "error": err,
                            "chunk": chunk
                        }
                    else:
                        yield {
                            "type": "chunk_success",
                            "chunk_idx": c_idx,
                            "evaluations": evals,
                            "duration_sec": dur
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
        active_model = candidates_to_try[0] if candidates_to_try else "models/gemini-2.5-flash"

        chunks = [papers[i:i + MICRO_CHUNK_SIZE] for i in range(0, total_papers, MICRO_CHUNK_SIZE)]
        total_chunks = len(chunks)

        yield f"data: {json.dumps({'event': 'init', 'total_papers': total_papers, 'total_chunks': total_chunks, 'chunk_size': MICRO_CHUNK_SIZE, 'active_model': active_model})}\n\n"

        stats = {"INCLUDED": 0, "EXCLUDED": 0, "UNSURE": 0}
        evaluated_count = 0
        paper_map = {p["id"]: p for p in papers}
        start_time = time.time()

        for chunk_idx, chunk in enumerate(chunks, 1):
            chunk_start = time.time()
            yield f"data: {json.dumps({'event': 'chunk_start', 'chunk_idx': chunk_idx, 'total_chunks': total_chunks, 'chunk_size': len(chunk)})}\n\n"

            try:
                evals = cls._evaluate_single_chunk(
                    chunk_papers=chunk,
                    pico=pico,
                    ic_list=ic_list,
                    ec_list=ec_list,
                    gemini_key=gemini_key,
                    candidates_to_try=candidates_to_try,
                    research_question=research_question,
                    research_context=research_context
                )

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

                    try:
                        Database.update_paper(paper_id, update_data, project_id=project_id)
                    except Exception as db_err:
                        logger.error(f"Failed to update paper {paper_id}: {db_err}")

                    elapsed = time.time() - start_time
                    avg_per_paper = elapsed / max(1, evaluated_count)
                    remaining = total_papers - evaluated_count
                    eta = int(remaining * avg_per_paper)

                    paper_meta = paper_map.get(paper_id, {})
                    yield f"data: {json.dumps({'event': 'paper_evaluated', 'paper_id': paper_id, 'title': paper_meta.get('title', ''), 'year': paper_meta.get('year', ''), 'source': paper_meta.get('source', ''), 'decision': decision, 'confidence': confidence, 'exclusion_reason': exclusion_reason, 'rationale': rationale, 'matched_criteria': item.get('matched_criteria', []), 'raw_json': item, 'evaluated_count': evaluated_count, 'total_papers': total_papers, 'progress_percent': round((evaluated_count / total_papers) * 100, 1), 'stats': stats, 'eta_seconds': eta, 'latency_seconds': round(time.time() - chunk_start, 2)})}\n\n"

            except Exception as e:
                logger.error(f"Chunk {chunk_idx} failed: {e}")
                yield f"data: {json.dumps({'event': 'chunk_error', 'chunk_idx': chunk_idx, 'error': str(e)})}\n\n"

            yield f": heartbeat\n\n"

        final_papers = Database.get_all_papers(project_id)
        yield f"data: {json.dumps({'event': 'complete', 'total_papers': total_papers, 'evaluated_count': evaluated_count, 'stats': stats, 'total_duration_sec': round(time.time() - start_time, 2), 'papers': final_papers})}\n\n"
