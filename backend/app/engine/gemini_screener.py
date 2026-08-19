import json
import logging
import os
import time
import requests
from typing import List, Dict, Any, Optional, Generator
from ..database import Database

logger = logging.getLogger(__name__)

DEFAULT_FALLBACKS = [
    "models/gemini-flash-latest",
    "models/gemini-2.5-flash",
    "models/gemini-2.5-flash-lite",
    "models/gemini-3-flash",
    "models/gemini-3-pro",
    "models/gemini-2.5-pro",
]

CHUNK_SIZE = 10  # Process 10 papers per batch to guarantee zero timeouts and fast feedback

class GeminiScreener:
    @staticmethod
    def get_available_models(api_key: str) -> List[str]:
        """
        Queries Google Gemini ModelService to get all supported model names for this specific API key.
        """
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}&pageSize=100"
            res = requests.get(url, timeout=10)
            if res.status_code == 200:
                data = res.json()
                models = [
                    m.get("name") for m in data.get("models", [])
                    if "generateContent" in m.get("supportedGenerationMethods", [])
                ]
                if not models:
                    logger.error("ListModels returned HTTP 200 but found 0 models supporting generateContent.")
                else:
                    logger.info(f"Available Gemini models for key: {models}")
                return models
            else:
                logger.error(f"ListModels call failed with HTTP {res.status_code}: {res.text}")
        except Exception as e:
            logger.error(f"Error querying ListModels: {e}")
        return []

    @classmethod
    def _evaluate_single_chunk(
        cls,
        chunk_papers: List[Dict[str, Any]],
        pico: Dict[str, str],
        ic_list: List[str],
        ec_list: List[str],
        gemini_key: str,
        candidates_to_try: List[str],
        research_question: str
    ) -> List[Dict[str, Any]]:
        """
        Evaluates a single chunk of <= 10 papers using candidate models.
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

        system_instruction = f"""
You are an expert Systematic Literature Review (SLR) screener adhering to PRISMA 2020 guidelines and strict scientific rigor.
Your task is to evaluate the Title and Abstract of each candidate paper against the provided Research Question, PICO framework, Inclusion Criteria (IC), and Exclusion Criteria (EC).

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

DECISION RULES:
1. "INCLUDED": Paper satisfies all primary ICs, matches 0 ECs, directly addresses PICO scope, and your confidence score is >= 0.80.
2. "EXCLUDED": Paper violates PICO scope or explicitly matches ANY Exclusion Criterion (EC1-EC5). You MUST specify the exact matched exclusion_reason (e.g., "EC1: Focuses on network packet headers").
3. "UNSURE": The abstract is ambiguous, lacks concrete methodology, relevance is borderline, or your confidence is < 0.70.

STRICT JSON OUTPUT FORMAT:
You MUST output ONLY a valid JSON array matching this exact schema for every input paper:
[
  {{
    "id": "string",
    "decision": "INCLUDED" | "EXCLUDED" | "UNSURE",
    "confidence_score": float (between 0.0 and 1.0),
    "matched_criteria": ["string"],
    "exclusion_reason": "string" or null,
    "scientific_rationale": "Clear, objective sentence justifying decision based strictly on the abstract"
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
                try:
                    response = requests.post(url, headers=headers, json=payload, timeout=40)
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
                        return evaluations
                    else:
                        last_error = response.text
                except Exception as e:
                    last_error = str(e)
                    continue

        raise Exception(f"Gemini API Chunk Error: {last_error}")

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
        project_id: str = "default"
    ) -> Generator[str, None, None]:
        """
        Micro-batch streaming generator for Server-Sent Events (SSE).
        Processes candidate papers in chunks of 10, yields live progress, and incrementally saves to SQLite DB.
        """
        gemini_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not gemini_key:
            yield f"data: {json.dumps({'event': 'error', 'message': 'GEMINI_API_KEY is required for AI screening.'})}\n\n"
            return

        if not papers:
            yield f"data: {json.dumps({'event': 'complete', 'total': 0, 'evaluated': 0, 'stats': {}})}\n\n"
            return

        total_papers = len(papers)
        chunks = [papers[i:i + CHUNK_SIZE] for i in range(0, total_papers, CHUNK_SIZE)]
        total_chunks = len(chunks)

        # 1. Discover models
        available_models = cls.get_available_models(gemini_key)
        candidates_to_try = []

        if model_name and model_name != "auto":
            clean_m = model_name if model_name.startswith("models/") else f"models/{model_name}"
            candidates_to_try.append(clean_m)

        if available_models:
            flash_models = []
            other_models = []
            for m in available_models:
                m_lower = m.lower()
                if "flash" in m_lower and "flash-lite" not in m_lower and "-8b" not in m_lower:
                    flash_models.append(m)
                else:
                    other_models.append(m)
            for m in flash_models + other_models:
                if m not in candidates_to_try:
                    candidates_to_try.append(m)

        for fb in DEFAULT_FALLBACKS:
            if fb not in candidates_to_try:
                candidates_to_try.append(fb)

        active_model = candidates_to_try[0] if candidates_to_try else "models/gemini-flash-latest"

        # Emit init event
        yield f"data: {json.dumps({'event': 'init', 'total_papers': total_papers, 'total_chunks': total_chunks, 'chunk_size': CHUNK_SIZE, 'active_model': active_model})}\n\n"

        stats = {"INCLUDED": 0, "EXCLUDED": 0, "UNSURE": 0}
        evaluated_count = 0
        all_evaluations = []
        paper_map = {p["id"]: p for p in papers}

        start_time = time.time()

        for chunk_idx, chunk in enumerate(chunks, 1):
            chunk_start_time = time.time()
            chunk_ids = [p["id"] for p in chunk]

            # Emit chunk start
            yield f"data: {json.dumps({'event': 'chunk_start', 'chunk_idx': chunk_idx, 'total_chunks': total_chunks, 'chunk_size': len(chunk), 'paper_ids': chunk_ids})}\n\n"

            chunk_evals = []
            retry_count = 0
            max_retries = 2
            success = False

            while retry_count <= max_retries and not success:
                try:
                    chunk_evals = cls._evaluate_single_chunk(
                        chunk_papers=chunk,
                        pico=pico,
                        ic_list=ic_list,
                        ec_list=ec_list,
                        gemini_key=gemini_key,
                        candidates_to_try=candidates_to_try,
                        research_question=research_question
                    )
                    success = True
                except Exception as e:
                    retry_count += 1
                    logger.warning(f"Chunk {chunk_idx} failed (attempt {retry_count}/{max_retries + 1}): {e}")
                    if retry_count <= max_retries:
                        time.sleep(2.0)
                    else:
                        yield f"data: {json.dumps({'event': 'chunk_error', 'chunk_idx': chunk_idx, 'error': str(e)})}\n\n"

            if success and chunk_evals:
                # Incremental SQLite Save + Per-Paper Event Emission
                for eval_item in chunk_evals:
                    paper_id = eval_item.get("id")
                    decision = eval_item.get("decision", "UNSURE")
                    confidence = eval_item.get("confidence_score", 0.0)
                    exclusion_reason = eval_item.get("exclusion_reason")
                    rationale = eval_item.get("scientific_rationale", "")

                    if decision in stats:
                        stats[decision] += 1

                    evaluated_count += 1
                    all_evaluations.append(eval_item)

                    # Incremental DB update
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
                        logger.error(f"Failed to incrementally update paper {paper_id}: {db_err}")

                    # Calculate ETA
                    elapsed = time.time() - start_time
                    avg_per_paper = elapsed / max(1, evaluated_count)
                    remaining_papers = total_papers - evaluated_count
                    eta_seconds = int(remaining_papers * avg_per_paper)

                    # Stream individual paper verdict event
                    paper_meta = paper_map.get(paper_id, {})
                    matched_criteria = eval_item.get("matched_criteria", [])
                    yield f"data: {json.dumps({'event': 'paper_evaluated', 'paper_id': paper_id, 'title': paper_meta.get('title', ''), 'year': paper_meta.get('year', ''), 'source': paper_meta.get('source', ''), 'decision': decision, 'confidence': confidence, 'exclusion_reason': exclusion_reason, 'rationale': rationale, 'matched_criteria': matched_criteria, 'raw_json': eval_item, 'evaluated_count': evaluated_count, 'total_papers': total_papers, 'progress_percent': round((evaluated_count / total_papers) * 100, 1), 'stats': stats, 'eta_seconds': eta_seconds, 'latency_seconds': round(time.time() - chunk_start_time, 2)})}\n\n"

            # Emit chunk completion
            chunk_duration = round(time.time() - chunk_start_time, 2)
            yield f"data: {json.dumps({'event': 'chunk_done', 'chunk_idx': chunk_idx, 'total_chunks': total_chunks, 'duration_sec': chunk_duration})}\n\n"

        # Final complete event
        final_papers = Database.get_all_papers(project_id)
        yield f"data: {json.dumps({'event': 'complete', 'total_papers': total_papers, 'evaluated_count': evaluated_count, 'stats': stats, 'total_duration_sec': round(time.time() - start_time, 2), 'papers': final_papers})}\n\n"

    @classmethod
    def screen_papers_batch(
        cls,
        papers: List[Dict[str, Any]],
        pico: Dict[str, str],
        ic_list: List[str],
        ec_list: List[str],
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        research_question: str = "How effective are prompt-based LLMs (few-shot) compared with a fine-tuned PhoBERT model for Vietnamese scam message classification?"
    ) -> List[Dict[str, Any]]:
        """
        Synchronous batch screening with automatic micro-batching.
        """
        gemini_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not gemini_key:
            raise ValueError("GEMINI_API_KEY is required for AI screening.")

        if not papers:
            return []

        available_models = cls.get_available_models(gemini_key)
        candidates_to_try = []

        if model_name and model_name != "auto":
            clean_m = model_name if model_name.startswith("models/") else f"models/{model_name}"
            candidates_to_try.append(clean_m)

        if available_models:
            flash_models = []
            other_models = []
            for m in available_models:
                m_lower = m.lower()
                if "flash" in m_lower and "flash-lite" not in m_lower and "-8b" not in m_lower:
                    flash_models.append(m)
                else:
                    other_models.append(m)
            for m in flash_models + other_models:
                if m not in candidates_to_try:
                    candidates_to_try.append(m)

        for fb in DEFAULT_FALLBACKS:
            if fb not in candidates_to_try:
                candidates_to_try.append(fb)

        chunks = [papers[i:i + CHUNK_SIZE] for i in range(0, len(papers), CHUNK_SIZE)]
        all_evals = []

        for chunk in chunks:
            evals = cls._evaluate_single_chunk(
                chunk_papers=chunk,
                pico=pico,
                ic_list=ic_list,
                ec_list=ec_list,
                gemini_key=gemini_key,
                candidates_to_try=candidates_to_try,
                research_question=research_question
            )
            all_evals.extend(evals)

        return all_evals
