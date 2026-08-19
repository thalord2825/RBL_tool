import logging
import json
import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from concurrent.futures import ThreadPoolExecutor, as_completed

from .schemas import (
    SearchRequest,
    PaperUpdate,
    AiScreenRequest,
    MergeDuplicatesRequest,
    GitCommitRequest,
    ExportRequest,
    ProtocolUpdateRequest,
    BulkUpdatePapersRequest,
    BulkDeletePapersRequest,
    CsvImportRequest,
    SelectionRuleCreate,
    BulkFetchAbstractsRequest,
    UpdateAbstractRequest
)
from .database import Database
from .crawlers import (
    ArxivCrawler,
    OpenAlexCrawler,
    SemanticScholarCrawler,
    CrossrefCrawler,
    GoogleScholarCrawler
)
from .engine.dedup_engine import DeduplicationEngine
from .engine.gemini_screener import GeminiScreener
from .engine.rbl_exporter import RblExporter
from .engine.github_atomic import GitHubAtomicCommitter
from .engine.abstract_resolver import AbstractResolver

# Setup structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("rbl-backend")

app = FastAPI(
    title="RBL Research Intelligence Backend",
    description="SLR Metadata Harvesting, Advanced Deduplication, and Gemini AI Screening Engine",
    version="2.2.0"
)

# Enable CORS for React frontend (ports 5173, 5174, 5175)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize SQLite database tables on startup
Database.init_db()

CRAWLER_MAP = {
    "ArXiv": ArxivCrawler,
    "OpenAlex": OpenAlexCrawler,
    "Semantic Scholar": SemanticScholarCrawler,
    "CrossRef": CrossrefCrawler,
    "Google Scholar": GoogleScholarCrawler
}

@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "RBL Research Intelligence Backend",
        "version": "2.2.0"
    }

@app.get("/api/papers")
def get_papers(project_id: str = "default"):
    papers = Database.get_all_papers(project_id)
    flagged = DeduplicationEngine.flag_corpus_duplicates(papers)
    return {
        "count": len(flagged),
        "papers": flagged
    }

@app.post("/api/search")
def search_and_harvest(req: SearchRequest):
    logger.info(f"Received search request: query='{req.query}', sources={req.sources}, since={req.since_year}")
    
    raw_harvested = []
    crawlers_to_run = []
    
    for s in req.sources:
        if s in CRAWLER_MAP:
            crawlers_to_run.append((s, CRAWLER_MAP[s]))
            
    def fetch_source(src_name, crawler_cls):
        start_t = time.time()
        try:
            crawler = crawler_cls()
            results = crawler.search(
                query=req.query,
                limit=req.limit_per_source,
                start_year=req.since_year,
                since_year=req.since_year
            )
            duration = round(time.time() - start_t, 2)
            logger.info(f"Source '{src_name}' harvested {len(results)} papers in {duration}s")
            return src_name, results, None, duration
        except Exception as e:
            duration = round(time.time() - start_t, 2)
            logger.error(f"Source '{src_name}' failed after {duration}s: {e}")
            return src_name, [], str(e), duration

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(fetch_source, name, cls) for name, cls in crawlers_to_run]
        for f in as_completed(futures):
            src_name, results, err, duration = f.result()
            if results:
                raw_harvested.extend(results)

    # Deduplicate against existing DB corpus
    existing_papers = Database.get_all_papers(req.project_id)
    unique_new, duplicates_count = DeduplicationEngine.deduplicate(existing_papers, raw_harvested)
    
    if unique_new:
        Database.save_papers(unique_new, project_id=req.project_id)
        
    all_current_papers = Database.get_all_papers(req.project_id)
    flagged_corpus = DeduplicationEngine.flag_corpus_duplicates(all_current_papers)
    
    return {
        "harvested_count": len(raw_harvested),
        "duplicates_filtered": duplicates_count,
        "new_added": len(unique_new),
        "total_corpus": len(flagged_corpus),
        "papers": flagged_corpus
    }

@app.post("/api/stream/harvest")
def stream_search_and_harvest(req: SearchRequest):
    """
    Server-Sent Events (SSE) streaming endpoint for live multi-source harvesting progress.
    """
    def event_stream():
        start_time = time.time()
        yield f"data: {json.dumps({'event': 'init', 'query': req.query, 'sources': req.sources, 'since_year': req.since_year, 'auto_screen': req.auto_screen})}\n\n"
        yield f"data: {json.dumps({'event': 'stage_change', 'stage': 'CRAWL', 'sources': req.sources})}\n\n"

        crawlers_to_run = [(s, CRAWLER_MAP[s]) for s in req.sources if s in CRAWLER_MAP]
        raw_harvested = []
        source_summaries = {}

        def fetch_source(src_name, crawler_cls):
            st = time.time()
            try:
                crawler = crawler_cls()
                results = crawler.search(
                    query=req.query,
                    limit=req.limit_per_source,
                    start_year=req.since_year,
                    since_year=req.since_year
                )
                dur = round(time.time() - st, 2)
                return src_name, results, None, dur
            except Exception as e:
                dur = round(time.time() - st, 2)
                return src_name, [], str(e), dur

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {executor.submit(fetch_source, name, cls): name for name, cls in crawlers_to_run}
            
            for future in as_completed(futures):
                src_name = futures[future]
                try:
                    name, results, err, dur = future.result()
                    if err:
                        source_summaries[name] = {"count": 0, "status": "error", "error": err, "duration_sec": dur}
                        yield f"data: {json.dumps({'event': 'source_done', 'source': name, 'count': 0, 'status': 'error', 'error': err, 'duration_sec': dur})}\n\n"
                    else:
                        raw_harvested.extend(results)
                        source_summaries[name] = {"count": len(results), "status": "ok", "duration_sec": dur}
                        yield f"data: {json.dumps({'event': 'source_done', 'source': name, 'count': len(results), 'status': 'ok', 'duration_sec': dur})}\n\n"
                except Exception as ex:
                    source_summaries[src_name] = {"count": 0, "status": "error", "error": str(ex), "duration_sec": 0}
                    yield f"data: {json.dumps({'event': 'source_done', 'source': src_name, 'count': 0, 'status': 'error', 'error': str(ex)})}\n\n"

        # Deduplication phase
        yield f"data: {json.dumps({'event': 'stage_change', 'stage': 'DEDUP', 'raw_count': len(raw_harvested)})}\n\n"
        yield f"data: {json.dumps({'event': 'dedup_start', 'raw_count': len(raw_harvested)})}\n\n"
        existing_papers = Database.get_all_papers(req.project_id)
        unique_new, duplicates_count = DeduplicationEngine.deduplicate(existing_papers, raw_harvested)
        
        ai_stats = {"INCLUDED": 0, "EXCLUDED": 0, "UNSURE": 0}

        # Optional Inline Real-Time AI Screening during Crawl
        if unique_new and req.auto_screen:
            protocol = Database.get_protocol(req.project_id) or {}
            pico = protocol.get("pico") or {
                "P": "Scam messages (SMS, Zalo, Messenger, Email) and fraudulent call scripts targeting users.",
                "I": "Text classification based on Large Language Models (LLMs) or Pre-trained Language Models (PhoBERT).",
                "C": "Traditional filtering mechanisms based on blacklists or keyword matching.",
                "O": "Classification performance (Accuracy, Precision, Recall, Macro-F1), Latency, Cost."
            }
            ic_list = protocol.get("ic_list") or []
            ec_list = protocol.get("ec_list") or []

            yield f"data: {json.dumps({'event': 'stage_change', 'stage': 'AI_SCREEN', 'count': len(unique_new), 'model': req.model_name})}\n\n"
            yield f"data: {json.dumps({'event': 'inline_screen_start', 'count': len(unique_new), 'model': req.model_name})}\n\n"
            
            evaluations = GeminiScreener.screen_papers_batch(
                papers=unique_new,
                pico=pico,
                ic_list=ic_list,
                ec_list=ec_list,
                api_key=req.api_key,
                model_name=req.model_name,
                research_context=req.research_context
            )

            eval_map = {e["id"]: e for e in evaluations if "id" in e}
            screened_unique = []
            screened_counter = 0

            for p in unique_new:
                e_info = eval_map.get(p["id"])
                if e_info:
                    decision = e_info.get("decision", "PENDING")
                    confidence = e_info.get("confidence_score", 0.8)
                    rationale = e_info.get("scientific_rationale", "")
                    exc_reason = e_info.get("exclusion_reason")

                    p["status"] = decision
                    p["ai_decision"] = decision
                    p["ai_confidence"] = confidence
                    p["ai_rationale"] = rationale
                    p["exclusion_reason"] = exc_reason

                    if decision in ai_stats:
                        ai_stats[decision] += 1
                    screened_counter += 1

                    yield f"data: {json.dumps({'event': 'paper_screened', 'paper_id': p['id'], 'title': p.get('title', '')[:80], 'decision': decision, 'confidence': confidence, 'exclusion_reason': exc_reason, 'screened_count': screened_counter, 'total_to_screen': len(unique_new), 'ai_stats': ai_stats})}\n\n"
                
                # Check discard_excluded setting
                if req.discard_excluded and p.get("status") == "EXCLUDED":
                    continue
                screened_unique.append(p)

            unique_new = screened_unique

        if unique_new:
            Database.save_papers(unique_new, project_id=req.project_id)
            
        all_current = Database.get_all_papers(req.project_id)
        flagged_corpus = DeduplicationEngine.flag_corpus_duplicates(all_current)

        total_dur = round(time.time() - start_time, 2)
        yield f"data: {json.dumps({'event': 'stage_change', 'stage': 'COMPLETE'})}\n\n"
        yield f"data: {json.dumps({'event': 'complete', 'harvested_count': len(raw_harvested), 'duplicates_filtered': duplicates_count, 'new_added': len(unique_new), 'total_corpus': len(flagged_corpus), 'duration_sec': total_dur, 'papers': flagged_corpus, 'ai_stats': ai_stats})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

@app.post("/api/stream/ai-screen")
def stream_ai_screening(req: AiScreenRequest):
    """
    Server-Sent Events (SSE) streaming endpoint for Gemini AI auto-screening with micro-batch chunking.
    """
    all_papers = Database.get_all_papers(req.project_id)
    if req.paper_ids:
        target_papers = [p for p in all_papers if p.get("id") in req.paper_ids]
    else:
        target_papers = [p for p in all_papers if p.get("status") == "PENDING" or not p.get("ai_decision")]
        
    if not target_papers:
        target_papers = all_papers

    if not target_papers:
        def empty_stream():
            yield f"data: {json.dumps({'event': 'error', 'message': 'No papers in corpus to screen.'})}\n\n"
        return StreamingResponse(empty_stream(), media_type="text/event-stream")

    return StreamingResponse(
        GeminiScreener.screen_papers_stream(
            papers=target_papers,
            pico=req.pico,
            ic_list=req.ic_list,
            ec_list=req.ec_list,
            api_key=req.api_key,
            model_name=req.model_name,
            research_question=req.research_question or "",
            research_context=req.research_context or "",
            project_id=req.project_id
        ),
        media_type="text/event-stream"
    )

@app.post("/api/ai-screen")
def ai_screen_papers(req: AiScreenRequest):
    all_papers = Database.get_all_papers(req.project_id)
    if req.paper_ids:
        target_papers = [p for p in all_papers if p.get("id") in req.paper_ids]
    else:
        target_papers = [p for p in all_papers if p.get("status") == "PENDING" or not p.get("ai_decision")]
        
    if not target_papers:
        target_papers = all_papers

    if not target_papers:
        raise HTTPException(status_code=400, detail="No papers in corpus to evaluate with AI.")

    try:
        evaluations = GeminiScreener.screen_papers_batch(
            papers=target_papers,
            pico=req.pico,
            ic_list=req.ic_list,
            ec_list=req.ec_list,
            api_key=req.api_key,
            model_name=req.model_name,
            research_question=req.research_question or ""
        )
        
        updated_count = 0
        for ev in evaluations:
            p_id = ev.get("id")
            decision = ev.get("decision", "UNSURE")
            confidence = ev.get("confidence_score", 0.5)
            rationale = ev.get("scientific_rationale", "")
            ec_reason = ev.get("exclusion_reason")
            
            updates = {
                "ai_decision": decision,
                "ai_confidence": confidence,
                "ai_rationale": rationale
            }
            if decision == "EXCLUDED" and ec_reason:
                updates["status"] = "EXCLUDED"
                updates["exclusion_reason"] = ec_reason
            elif decision == "INCLUDED":
                updates["status"] = "INCLUDED"
                
            Database.update_paper(p_id, updates, project_id=req.project_id)
            updated_count += 1
            
        all_updated = Database.get_all_papers(req.project_id)
        flagged_corpus = DeduplicationEngine.flag_corpus_duplicates(all_updated)
        
        return {
            "evaluated_count": updated_count,
            "papers": flagged_corpus
        }
    except Exception as e:
        logger.error(f"AI Auto-screening failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/papers/{paper_id}")
def update_paper(paper_id: str, updates: PaperUpdate, project_id: str = "default"):
    clean_updates = {k: v for k, v in updates.dict().items() if v is not None}
    if not clean_updates:
        raise HTTPException(status_code=400, detail="No valid update fields provided.")
        
    updated = Database.update_paper(paper_id, clean_updates, project_id=project_id)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Paper '{paper_id}' not found.")
    return updated

@app.delete("/api/papers/{paper_id}")
def delete_paper(paper_id: str, project_id: str = "default"):
    success = Database.delete_paper(paper_id, project_id=project_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Paper '{paper_id}' not found.")
    return {"status": "deleted", "id": paper_id}

@app.post("/api/papers/bulk-update")
def bulk_update_papers(req: BulkUpdatePapersRequest):
    clean_updates = {k: v for k, v in req.updates.dict().items() if v is not None}
    if not clean_updates:
        raise HTTPException(status_code=400, detail="No valid update fields provided.")
    updated_count = Database.bulk_update_papers(req.paper_ids, clean_updates, project_id=req.project_id)
    all_papers = Database.get_all_papers(req.project_id)
    flagged = DeduplicationEngine.flag_corpus_duplicates(all_papers)
    return {
        "status": "updated",
        "updated_count": updated_count,
        "papers": flagged
    }

@app.post("/api/papers/bulk-delete")
def bulk_delete_papers(req: BulkDeletePapersRequest):
    deleted_count = Database.bulk_delete_papers(req.paper_ids, project_id=req.project_id)
    all_papers = Database.get_all_papers(req.project_id)
    flagged = DeduplicationEngine.flag_corpus_duplicates(all_papers)
    return {
        "status": "deleted",
        "deleted_count": deleted_count,
        "papers": flagged
    }

@app.post("/api/papers/merge-duplicates")
def merge_duplicates(req: MergeDuplicatesRequest, project_id: str = "default"):
    merged = Database.merge_two_papers(req.keep_id, req.remove_id, project_id=project_id)
    if not merged:
        raise HTTPException(status_code=404, detail="Failed to merge papers.")
        
    all_papers = Database.get_all_papers(project_id)
    flagged = DeduplicationEngine.flag_corpus_duplicates(all_papers)
    return {
        "status": "merged",
        "kept_paper": merged,
        "papers": flagged
    }

@app.post("/api/papers/import-csv")
def import_csv_papers(req: CsvImportRequest):
    """
    Import papers from CSV with automated server-side deduplication and atomic SQLite ingestion.
    """
    raw_papers = []
    for item in req.papers:
        if not item.title or not item.title.strip():
            continue
        raw_papers.append({
            "title": item.title.strip(),
            "authors": item.authors or "N/A",
            "year": item.year,
            "venue": item.venue or "N/A",
            "abstract": item.abstract or "",
            "doi": item.doi if (item.doi and item.doi != "N/A") else None,
            "url": item.url or (f"https://doi.org/{item.doi}" if item.doi else None),
            "source": item.source or req.source_label or "CSV Import",
            "citations_count": item.citations_count or 0,
            "status": "PENDING"
        })

    if not raw_papers:
        raise HTTPException(status_code=400, detail="No valid paper records with non-empty titles provided.")

    existing_papers = Database.get_all_papers(req.project_id)
    unique_new, duplicates_count = DeduplicationEngine.deduplicate(existing_papers, raw_papers)

    if unique_new:
        Database.save_papers(unique_new, project_id=req.project_id)

    all_current_papers = Database.get_all_papers(req.project_id)
    flagged_corpus = DeduplicationEngine.flag_corpus_duplicates(all_current_papers)

    return {
        "imported_count": len(raw_papers),
        "duplicates_filtered": duplicates_count,
        "new_added": len(unique_new),
        "total_corpus": len(flagged_corpus),
        "papers": flagged_corpus
    }

@app.post("/api/export")
def generate_export_files(req: ExportRequest):
    papers = Database.get_all_papers(req.project_id)
    package = RblExporter.generate_full_package(
        papers=papers,
        author_name=req.author_name,
        search_query=req.search_query,
        sources=req.sources
    )
    return package

@app.post("/api/git-commit")
def atomic_git_commit(req: GitCommitRequest):
    papers = Database.get_all_papers(req.project_id)
    package = RblExporter.generate_full_package(
        papers=papers,
        author_name=req.author_name,
        search_query=req.search_query,
        sources=req.sources
    )
    files = package.get("files", {})
    included_count = len(package.get("prisma_stats", {}).get("03_included", []))
    
    commit_res = GitHubAtomicCommitter.create_atomic_commit(
        repo_owner=req.repo_owner,
        repo_name=req.repo_name,
        branch=req.branch,
        member_path=req.member_path,
        files_dict=files,
        github_token=req.github_token,
        author_name=req.author_name,
        commit_prefix=req.commit_prefix,
        included_count=included_count
    )
    return commit_res

@app.get("/api/protocol")
def get_protocol(project_id: str = "default"):
    protocol = Database.get_protocol(project_id)
    if not protocol:
        return {
            "project_id": project_id,
            "pico": {
                "P": "Scam messages (SMS, Zalo, Messenger, Email) and fraudulent call scripts targeting users, particularly within the context of the Vietnamese language and community alert platforms.",
                "I": "Text classification based on Large Language Models (LLMs) utilizing In-context Learning techniques (Zero-shot, Few-shot, Few-shot + taxonomy) integrated into software systems.",
                "C": "Fine-tuned Pre-trained Language Models (such as PhoBERT) and traditional filtering mechanisms based on blacklists or keyword matching.",
                "O": "Classification performance (Accuracy, Precision, Recall, Macro-F1 per scam category), system inference latency (< 3 seconds), and API token cost (Cost per request)."
            },
            "ic_list": [
                "IC1: Studies focusing on the detection and classification of spam messages, scam messages (phishing/smishing), or fraud via conversational scripts.",
                "IC2: Papers that apply or evaluate Large Language Models (LLMs via prompting) or Pre-trained Language Models (PLMs like BERT, PhoBERT).",
                "IC3: Studies providing clear empirical results with metrics such as Accuracy, Precision, Recall, F1-score, inference latency, or computational cost.",
                "IC4: Papers discussing system architecture, integrating AI into real-world platforms (web/mobile apps), or community alert mechanisms (crowdsourcing/blacklist).",
                "IC5: Studies published from 2020 onwards."
            ],
            "ec_list": [
                "EC1: Studies focusing solely on malware analysis, or pure URL identification via hash algorithms without semantic text analysis.",
                "EC2: Papers dealing with acoustic voice/audio processing to detect fraudulent calls rather than processing text/scripts.",
                "EC3: Studies that do not utilize Machine Learning, LLMs, or PLMs (e.g., relying entirely on classical rule-based methods).",
                "EC4: Purely theoretical or vision papers lacking experimental datasets, practical implementations, or empirical evaluation.",
                "EC5: Papers not written in English, or where the full-text is inaccessible."
            ],
            "updated_at": None
        }
    return protocol

@app.put("/api/protocol")
def update_protocol(req: ProtocolUpdateRequest):
    saved = Database.save_protocol(
        project_id=req.project_id,
        pico=req.pico,
        ic_list=req.ic_list,
        ec_list=req.ec_list
    )
    return saved

@app.get("/api/selection-rules")
def get_selection_rules(project_id: str = "default"):
    return Database.get_selection_rules(project_id)

@app.post("/api/selection-rules")
def save_selection_rule(req: SelectionRuleCreate):
    rule_dict = {
        "title": req.title,
        "description": req.description,
        "match_mode": req.match_mode,
        "conditions": [c.dict() for c in req.conditions],
        "default_ec_reason": req.default_ec_reason
    }
    return Database.save_selection_rule(req.project_id, rule_dict)

@app.delete("/api/selection-rules/{rule_id}")
def delete_selection_rule(rule_id: str, project_id: str = "default"):
    success = Database.delete_selection_rule(rule_id, project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Selection rule not found.")
    return {"status": "deleted", "rule_id": rule_id}

@app.post("/api/papers/{paper_id}/fetch-abstract")
def fetch_single_paper_abstract(paper_id: str, project_id: str = "default"):
    papers = Database.get_all_papers(project_id)
    target = next((p for p in papers if p["id"] == paper_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Paper not found.")

    res = AbstractResolver.resolve_single_paper_abstract(target)
    if res.get("status") == "resolved" and res.get("abstract"):
        updated = Database.update_paper(paper_id, {"abstract": res["abstract"]}, project_id=project_id)
        return {
            "status": "success",
            "paper_id": paper_id,
            "abstract": res["abstract"],
            "source_resolved": res.get("source"),
            "paper": updated
        }
    elif res.get("status") == "already_present":
        return {
            "status": "already_present",
            "paper_id": paper_id,
            "abstract": res["abstract"],
            "source_resolved": res.get("source"),
            "paper": target
        }
    else:
        return {
            "status": "not_found",
            "paper_id": paper_id,
            "abstract": None,
            "message": "Unable to resolve abstract from OpenAlex, Semantic Scholar, CrossRef, or publisher page."
        }

@app.post("/api/papers/bulk-fetch-abstracts")
def bulk_fetch_abstracts(req: BulkFetchAbstractsRequest):
    all_papers = Database.get_all_papers(req.project_id)
    target_papers = [p for p in all_papers if p["id"] in req.paper_ids]

    if not target_papers:
        raise HTTPException(status_code=404, detail="No matching papers found.")

    results = AbstractResolver.bulk_resolve_abstracts(target_papers, max_workers=5)
    resolved_count = 0

    for r in results:
        if r.get("status") == "resolved" and r.get("abstract"):
            Database.update_paper(r["paper_id"], {"abstract": r["abstract"]}, project_id=req.project_id)
            resolved_count += 1

    updated_corpus = Database.get_all_papers(req.project_id)
    flagged = DeduplicationEngine.flag_corpus_duplicates(updated_corpus)

    return {
        "total_requested": len(target_papers),
        "resolved_count": resolved_count,
        "failed_count": len(target_papers) - resolved_count,
        "results": results,
        "papers": flagged
    }

@app.put("/api/papers/{paper_id}/abstract")
def update_manual_abstract(paper_id: str, req: UpdateAbstractRequest):
    updated = Database.update_paper(paper_id, {"abstract": req.abstract}, project_id=req.project_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Paper not found.")
    return {
        "status": "updated",
        "paper_id": paper_id,
        "abstract": req.abstract,
        "paper": updated
    }



