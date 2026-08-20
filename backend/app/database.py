import sqlite3
import os
import json
import time
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "rbl_corpus.db")

class Database:
    @staticmethod
    def get_connection():
        conn = sqlite3.connect(DB_PATH, timeout=30.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute("PRAGMA busy_timeout=30000;")
            conn.execute("PRAGMA synchronous=NORMAL;")
        except Exception:
            pass
        return conn

    @classmethod
    def init_db(cls):
        with cls.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS papers (
                id TEXT PRIMARY KEY,
                project_id TEXT DEFAULT 'default',
                title TEXT NOT NULL,
                authors TEXT,
                year INTEGER,
                venue TEXT,
                abstract TEXT,
                doi TEXT,
                url TEXT,
                source TEXT,
                citations_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'PENDING',
                exclusion_reason TEXT,
                relevance_notes TEXT,
                tool_model TEXT DEFAULT 'N/A',
                dataset_name TEXT DEFAULT 'N/A',
                sample_size_n TEXT DEFAULT 'N/A',
                metrics_evaluated TEXT DEFAULT 'N/A',
                empirical_results TEXT DEFAULT 'N/A',
                code_url TEXT DEFAULT 'N/A',
                limitations TEXT DEFAULT 'N/A',
                ai_decision TEXT,
                ai_confidence REAL,
                ai_rationale TEXT,
                duplicate_flag INTEGER DEFAULT 0,
                duplicate_with_id TEXT,
                duplicate_reason TEXT,
                created_at TEXT
            )
            """)
            
            # Execute migrations if columns are missing from older DB
            cursor.execute("PRAGMA table_info(papers)")
            columns = [row["name"] for row in cursor.fetchall()]
            
            new_cols = {
                "ai_decision": "TEXT",
                "ai_confidence": "REAL",
                "ai_rationale": "TEXT",
                "duplicate_flag": "INTEGER DEFAULT 0",
                "duplicate_with_id": "TEXT",
                "duplicate_reason": "TEXT",
                "duplicate_resolved": "INTEGER DEFAULT 0",
                "matched_ics": "TEXT"
            }
            for col_name, col_type in new_cols.items():
                if col_name not in columns:
                    cursor.execute(f"ALTER TABLE papers ADD COLUMN {col_name} {col_type}")

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS search_rules (
                id TEXT PRIMARY KEY,
                project_id TEXT DEFAULT 'default',
                title TEXT,
                query TEXT,
                sources TEXT,
                since_year INTEGER,
                created_at TEXT
            )
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS research_protocols (
                project_id TEXT PRIMARY KEY,
                pico TEXT,
                ic_list TEXT,
                ec_list TEXT,
                updated_at TEXT
            )
            """)

            cursor.execute("""
            CREATE TABLE IF NOT EXISTS selection_rules (
                id TEXT PRIMARY KEY,
                project_id TEXT DEFAULT 'default',
                title TEXT NOT NULL,
                description TEXT,
                match_mode TEXT DEFAULT 'AND',
                conditions TEXT,
                default_ec_reason TEXT,
                created_at TEXT
            )
            """)
            conn.commit()

    @classmethod
    def get_all_papers(cls, project_id: str = "default") -> List[Dict[str, Any]]:
        with cls.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM papers WHERE project_id = ? ORDER BY year DESC, id ASC", (project_id,))
            rows = cursor.fetchall()
            papers = []
            for row in rows:
                d = dict(row)
                d["duplicate_flag"] = bool(d.get("duplicate_flag", 0))
                d["duplicate_resolved"] = bool(d.get("duplicate_resolved", 0))
                papers.append(d)
            return papers

    @classmethod
    def save_papers(cls, papers: List[Dict[str, Any]], project_id: str = "default") -> int:
        for attempt in range(5):
            try:
                with cls.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT COUNT(*) FROM papers WHERE project_id = ?", (project_id,))
                    current_count = cursor.fetchone()[0]
                    
                    inserted = 0
                    for p in papers:
                        p_id = p.get("id")
                        if not p_id:
                            current_count += 1
                            p_id = f"P{current_count:03d}"
                            
                        created_at = p.get("created_at") or datetime.now().isoformat()
                        
                        # Clean exclusion reason if included
                        status_val = p.get("status", "PENDING")
                        ex_reason = None if status_val == "INCLUDED" else p.get("exclusion_reason")
                        
                        cursor.execute("""
                        INSERT OR REPLACE INTO papers (
                            id, project_id, title, authors, year, venue, abstract,
                            doi, url, source, citations_count, status, exclusion_reason,
                            relevance_notes, tool_model, dataset_name, sample_size_n,
                            metrics_evaluated, empirical_results, code_url, limitations,
                            ai_decision, ai_confidence, ai_rationale,
                            duplicate_flag, duplicate_with_id, duplicate_reason, duplicate_resolved, matched_ics, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            p_id,
                            project_id,
                            p.get("title", "Untitled"),
                            p.get("authors", ""),
                            p.get("year", 2024),
                            p.get("venue", "N/A"),
                            p.get("abstract", "N/A"),
                            p.get("doi", "N/A"),
                            p.get("url", ""),
                            p.get("source", "ArXiv"),
                            p.get("citations_count", 0),
                            status_val,
                            ex_reason,
                            p.get("relevance_notes"),
                            p.get("tool_model", "N/A"),
                            p.get("dataset_name", "N/A"),
                            p.get("sample_size_n", "N/A"),
                            p.get("metrics_evaluated", "N/A"),
                            p.get("empirical_results", "N/A"),
                            p.get("code_url", "N/A"),
                            p.get("limitations", "N/A"),
                            p.get("ai_decision"),
                            p.get("ai_confidence"),
                            p.get("ai_rationale"),
                            1 if p.get("duplicate_flag") else 0,
                            p.get("duplicate_with_id"),
                            p.get("duplicate_reason"),
                            1 if p.get("duplicate_resolved") else 0,
                            p.get("matched_ics"),
                            created_at
                        ))
                        inserted += 1
                    conn.commit()
                    return inserted
            except sqlite3.OperationalError as e:
                if "locked" in str(e) and attempt < 4:
                    time.sleep(0.3 * (attempt + 1))
                    continue
                raise

    @classmethod
    def update_paper(cls, paper_id: str, updates: Dict[str, Any], project_id: str = "default") -> Optional[Dict[str, Any]]:
        with cls.get_connection() as conn:
            cursor = conn.cursor()
            
            clean_updates = dict(updates)
            if clean_updates.get("status") == "INCLUDED" and "exclusion_reason" not in clean_updates:
                clean_updates["exclusion_reason"] = None

            set_clauses = []
            values = []
            for key, val in clean_updates.items():
                if key != "id":
                    set_clauses.append(f"{key} = ?")
                    # Handle boolean conversion
                    if key in ["duplicate_flag", "duplicate_resolved"]:
                        values.append(1 if val else 0)
                    else:
                        values.append(val)
                    
            if not set_clauses:
                return None
                
            values.append(paper_id)
            query = f"UPDATE papers SET {', '.join(set_clauses)} WHERE id = ?"
            cursor.execute(query, tuple(values))
            conn.commit()
            
            cursor.execute("SELECT * FROM papers WHERE id = ?", (paper_id,))
            row = cursor.fetchone()
            if row:
                d = dict(row)
                d["duplicate_flag"] = bool(d.get("duplicate_flag", 0))
                d["duplicate_resolved"] = bool(d.get("duplicate_resolved", 0))
                return d
            return None

    @classmethod
    def dismiss_duplicate(cls, paper_id: str, project_id: str = "default") -> Optional[Dict[str, Any]]:
        return cls.update_paper(paper_id, {
            "duplicate_flag": 0,
            "duplicate_resolved": 1,
            "duplicate_with_id": None,
            "duplicate_reason": None
        }, project_id=project_id)

    @classmethod
    def merge_two_papers(cls, keep_id: str, remove_id: str, project_id: str = "default") -> Optional[Dict[str, Any]]:
        for attempt in range(5):
            try:
                with cls.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT * FROM papers WHERE id = ? AND project_id = ?", (keep_id, project_id))
                    row_keep = cursor.fetchone()
                    cursor.execute("SELECT * FROM papers WHERE id = ? AND project_id = ?", (remove_id, project_id))
                    row_remove = cursor.fetchone()

                    if not row_keep or not row_remove:
                        return None

                    p_keep = dict(row_keep)
                    p_remove = dict(row_remove)

                    # Preserve richest metadata
                    abstract = p_keep.get("abstract") if p_keep.get("abstract") != "N/A" else p_remove.get("abstract")
                    doi = p_keep.get("doi") if p_keep.get("doi") != "N/A" else p_remove.get("doi")
                    url = p_keep.get("url") or p_remove.get("url")
                    citations = max(p_keep.get("citations_count", 0), p_remove.get("citations_count", 0))

                    # Update keep_id paper as resolved
                    cursor.execute("""
                    UPDATE papers SET
                        abstract = ?, doi = ?, url = ?, citations_count = ?,
                        duplicate_flag = 0, duplicate_resolved = 1, duplicate_with_id = NULL, duplicate_reason = NULL
                    WHERE id = ? AND project_id = ?
                    """, (abstract, doi, url, citations, keep_id, project_id))

                    # Delete the secondary remove_id paper
                    cursor.execute("DELETE FROM papers WHERE id = ? AND project_id = ?", (remove_id, project_id))
                    conn.commit()

                    cursor.execute("SELECT * FROM papers WHERE id = ? AND project_id = ?", (keep_id, project_id))
                    row = cursor.fetchone()
                    if row:
                        d = dict(row)
                        d["duplicate_flag"] = bool(d.get("duplicate_flag", 0))
                        d["duplicate_resolved"] = bool(d.get("duplicate_resolved", 0))
                        return d
                    return None
            except sqlite3.OperationalError as e:
                if "locked" in str(e) and attempt < 4:
                    time.sleep(0.3 * (attempt + 1))
                    continue
                raise

    @classmethod
    def delete_paper(cls, paper_id: str, project_id: str = "default") -> bool:
        for attempt in range(5):
            try:
                with cls.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute("DELETE FROM papers WHERE id = ? AND project_id = ?", (paper_id, project_id))
                    conn.commit()
                    return cursor.rowcount > 0
            except sqlite3.OperationalError as e:
                if "locked" in str(e) and attempt < 4:
                    time.sleep(0.3 * (attempt + 1))
                    continue
                raise

    @classmethod
    def bulk_update_papers(cls, paper_ids: List[str], updates: Dict[str, Any], project_id: str = "default") -> int:
        if not paper_ids or not updates:
            return 0
        for attempt in range(5):
            try:
                with cls.get_connection() as conn:
                    cursor = conn.cursor()
                    set_clauses = []
                    values = []
                    for key, val in updates.items():
                        if key != "id":
                            set_clauses.append(f"{key} = ?")
                            if key == "duplicate_flag":
                                values.append(1 if val else 0)
                            else:
                                values.append(val)
                    if not set_clauses:
                        return 0
                    placeholders = ",".join(["?"] * len(paper_ids))
                    query = f"UPDATE papers SET {', '.join(set_clauses)} WHERE project_id = ? AND id IN ({placeholders})"
                    cursor.execute(query, (*values, project_id, *paper_ids))
                    conn.commit()
                    return cursor.rowcount
            except sqlite3.OperationalError as e:
                if "locked" in str(e) and attempt < 4:
                    time.sleep(0.3 * (attempt + 1))
                    continue
                raise

    @classmethod
    def bulk_delete_papers(cls, paper_ids: List[str], project_id: str = "default") -> int:
        if not paper_ids:
            return 0
        for attempt in range(5):
            try:
                with cls.get_connection() as conn:
                    cursor = conn.cursor()
                    placeholders = ",".join(["?"] * len(paper_ids))
                    cursor.execute(f"DELETE FROM papers WHERE project_id = ? AND id IN ({placeholders})", (project_id, *paper_ids))
                    conn.commit()
                    return cursor.rowcount
            except sqlite3.OperationalError as e:
                if "locked" in str(e) and attempt < 4:
                    time.sleep(0.3 * (attempt + 1))
                    continue
                raise

    @classmethod
    def clear_papers(cls, project_id: str = "default") -> int:
        with cls.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM papers WHERE project_id = ?", (project_id,))
            conn.commit()
            return cursor.rowcount

    @classmethod
    def get_protocol(cls, project_id: str = "default") -> Optional[Dict[str, Any]]:
        with cls.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM research_protocols WHERE project_id = ?", (project_id,))
            row = cursor.fetchone()
            if row:
                d = dict(row)
                try:
                    d["pico"] = json.loads(d["pico"]) if isinstance(d.get("pico"), str) else d.get("pico", {})
                except Exception:
                    pass
                try:
                    d["ic_list"] = json.loads(d["ic_list"]) if isinstance(d.get("ic_list"), str) else d.get("ic_list", [])
                except Exception:
                    pass
                try:
                    d["ec_list"] = json.loads(d["ec_list"]) if isinstance(d.get("ec_list"), str) else d.get("ec_list", [])
                except Exception:
                    pass
                return d
            return None

    @classmethod
    def save_protocol(cls, project_id: str, pico: Dict[str, Any], ic_list: List[str], ec_list: List[str]) -> Dict[str, Any]:
        with cls.get_connection() as conn:
            cursor = conn.cursor()
            pico_json = json.dumps(pico)
            ic_json = json.dumps(ic_list)
            ec_json = json.dumps(ec_list)
            updated_at = datetime.now().isoformat()

            cursor.execute("""
            INSERT INTO research_protocols (project_id, pico, ic_list, ec_list, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(project_id) DO UPDATE SET
                pico = excluded.pico,
                ic_list = excluded.ic_list,
                ec_list = excluded.ec_list,
                updated_at = excluded.updated_at
            """, (project_id, pico_json, ic_json, ec_json, updated_at))
            conn.commit()

            return {
                "project_id": project_id,
                "pico": pico,
                "ic_list": ic_list,
                "ec_list": ec_list,
                "updated_at": updated_at
            }

    @classmethod
    def get_selection_rules(cls, project_id: str = "default") -> List[Dict[str, Any]]:
        with cls.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM selection_rules WHERE project_id = ? ORDER BY created_at DESC", (project_id,))
            rows = cursor.fetchall()
            rules = []
            for row in rows:
                d = dict(row)
                try:
                    d["conditions"] = json.loads(d["conditions"]) if isinstance(d.get("conditions"), str) else d.get("conditions", [])
                except Exception:
                    d["conditions"] = []
                rules.append(d)
            return rules

    @classmethod
    def save_selection_rule(cls, project_id: str, rule: Dict[str, Any]) -> Dict[str, Any]:
        with cls.get_connection() as conn:
            cursor = conn.cursor()
            rule_id = rule.get("id") or f"SR{int(datetime.now().timestamp()*1000)}"
            title = rule.get("title", "Custom Selection Rule")
            desc = rule.get("description", "")
            match_mode = rule.get("match_mode", "AND")
            conditions_json = json.dumps(rule.get("conditions", []))
            default_ec_reason = rule.get("default_ec_reason")
            created_at = datetime.now().isoformat()

            cursor.execute("""
            INSERT INTO selection_rules (id, project_id, title, description, match_mode, conditions, default_ec_reason, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                description = excluded.description,
                match_mode = excluded.match_mode,
                conditions = excluded.conditions,
                default_ec_reason = excluded.default_ec_reason
            """, (rule_id, project_id, title, desc, match_mode, conditions_json, default_ec_reason, created_at))
            conn.commit()

            return {
                "id": rule_id,
                "project_id": project_id,
                "title": title,
                "description": desc,
                "match_mode": match_mode,
                "conditions": rule.get("conditions", []),
                "default_ec_reason": default_ec_reason,
                "created_at": created_at
            }

    @classmethod
    def delete_selection_rule(cls, rule_id: str, project_id: str = "default") -> bool:
        with cls.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM selection_rules WHERE id = ? AND project_id = ?", (rule_id, project_id))
            conn.commit()
            return cursor.rowcount > 0

