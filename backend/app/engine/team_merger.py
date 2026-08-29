import os
import re
import csv
from typing import List, Dict, Any, Tuple
from .dedup_engine import DeduplicationEngine

class TeamSlrMerger:
    DEFAULT_REPO_PATH = r"C:\Users\USER\RBL_ScamShield"
    MEMBERS = ["minh_quang", "hai_phuc", "hoang_tran", "quoc_huy", "trung_hieu"]

    @classmethod
    def get_members_summary(cls, repo_path: str = DEFAULT_REPO_PATH) -> List[Dict[str, Any]]:
        summary = []
        for m in cls.MEMBERS:
            m_dir = os.path.join(repo_path, m, "SLR")
            exists = os.path.exists(m_dir)
            n_all = 0
            n_inc = 0
            n_screened = 0
            has_evidence = False

            if exists:
                f_01 = os.path.join(m_dir, "01_all_records.csv")
                f_02 = os.path.join(m_dir, "02_after_screening_v1.csv")
                f_03 = os.path.join(m_dir, "03_final_included.csv")
                f_ev = os.path.join(m_dir, "evidence-table.md")

                if os.path.exists(f_01):
                    with open(f_01, 'r', encoding='utf-8', errors='ignore') as f:
                        n_all = max(0, sum(1 for line in f) - 1)
                if os.path.exists(f_02):
                    with open(f_02, 'r', encoding='utf-8', errors='ignore') as f:
                        n_screened = max(0, sum(1 for line in f) - 1)
                if os.path.exists(f_03):
                    with open(f_03, 'r', encoding='utf-8', errors='ignore') as f:
                        n_inc = max(0, sum(1 for line in f) - 1)
                if os.path.exists(f_ev) and os.path.getsize(f_ev) > 100:
                    has_evidence = True

            summary.append({
                "member_key": m,
                "display_name": m.replace('_', ' ').title(),
                "path": m_dir,
                "exists": exists,
                "total_records": n_all,
                "screened_records": n_screened,
                "included_count": n_inc,
                "has_evidence_table": has_evidence
            })
        return summary

    @classmethod
    def parse_evidence_table(cls, file_path: str) -> Dict[str, Dict[str, Any]]:
        ev_map = {}
        if not os.path.exists(file_path):
            return ev_map

        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                if not line.startswith('|') or '---' in line or 'Paper (Title' in line or 'Paper ID' in line or 'Tool / LLM' in line:
                    continue
                cols = [c.strip() for c in line.split('|')[1:-1]]
                if len(cols) < 6:
                    continue

                paper_info = cols[1].strip()
                tool_model = cols[2].strip() if len(cols) > 2 else "N/A"
                dataset_name = cols[3].strip() if len(cols) > 3 else "N/A"
                metric = cols[4].strip() if len(cols) > 4 else "N/A"
                results = cols[5].strip() if len(cols) > 5 else "N/A"
                code = cols[6].strip() if len(cols) > 6 else "N/A"
                limitations = cols[7].strip() if len(cols) > 7 else "N/A"

                m_link = re.search(r'\[(.*?)\]\((.*?)\)', paper_info)
                if m_link:
                    title = m_link.group(1).strip()
                    url = m_link.group(2).strip()
                else:
                    title = re.sub(r'\(.*?\)', '', paper_info).strip()
                    url = ""

                norm_t = DeduplicationEngine.normalize_title(title)
                if norm_t:
                    ev_map[norm_t] = {
                        "title": title,
                        "url": url,
                        "tool_model": tool_model,
                        "dataset_name": dataset_name,
                        "metrics_evaluated": metric,
                        "empirical_results": results,
                        "code_url": code,
                        "limitations": limitations
                    }
        return ev_map

    @classmethod
    def merge_team_slr(cls, repo_path: str = DEFAULT_REPO_PATH) -> Dict[str, Any]:
        all_included = []
        global_evidence_map = {}

        for m in cls.MEMBERS:
            ev_file = os.path.join(repo_path, m, "SLR", "evidence-table.md")
            m_ev = cls.parse_evidence_table(ev_file)
            global_evidence_map.update(m_ev)

        for m in cls.MEMBERS:
            inc_file = os.path.join(repo_path, m, "SLR", "03_final_included.csv")
            if os.path.exists(inc_file):
                with open(inc_file, 'r', encoding='utf-8', errors='ignore') as f:
                    reader = csv.DictReader(f)
                    for r in reader:
                        title = (r.get('title') or r.get('Title') or '').strip()
                        if not title:
                            continue
                        all_included.append({
                            "original_id": r.get('id') or r.get('ID') or 'N/A',
                            "member": m,
                            "title": title,
                            "authors": (r.get('authors') or r.get('Authors') or 'N/A').strip(),
                            "year": int(r.get('year') or r.get('Year') or 2024),
                            "venue": (r.get('venue') or r.get('Venue') or 'N/A').strip(),
                            "doi": (r.get('doi') or r.get('DOI') or 'N/A').strip(),
                            "url": (r.get('url') or r.get('URL') or '').strip(),
                            "status": "INCLUDED"
                        })

        master_papers = []
        duplicate_matches = []

        for p in all_included:
            p_doi = DeduplicationEngine.normalize_doi(p['doi'])
            p_norm_title = DeduplicationEngine.normalize_title(p['title'])

            match_found = None
            for m_p in master_papers:
                m_doi = DeduplicationEngine.normalize_doi(m_p['doi'])
                if p_doi and m_doi and p_doi == m_doi:
                    match_found = m_p
                    break
                sim = DeduplicationEngine.title_similarity(p['title'], m_p['title'])
                if sim >= 0.88:
                    match_found = m_p
                    break

            if match_found:
                if p['member'] not in match_found['contributors']:
                    match_found['contributors'].append(p['member'])
                duplicate_matches.append({
                    "duplicate_title": p['title'],
                    "master_title": match_found['title'],
                    "member": p['member'],
                    "master_id": match_found['master_id']
                })
            else:
                p_copy = dict(p)
                p_copy['master_id'] = f"M{len(master_papers)+1:03d}"
                p_copy['contributors'] = [p['member']]

                matched_ev = None
                for ev_k, ev_v in global_evidence_map.items():
                    if DeduplicationEngine.title_similarity(p['title'], ev_v['title']) >= 0.88:
                        matched_ev = ev_v
                        break

                p_copy['tool_model'] = matched_ev['tool_model'] if matched_ev else "N/A"
                p_copy['dataset_name'] = matched_ev['dataset_name'] if matched_ev else "N/A"
                p_copy['sample_size_n'] = "N/A"
                p_copy['metrics_evaluated'] = matched_ev['metrics_evaluated'] if matched_ev else "N/A"
                p_copy['empirical_results'] = matched_ev['empirical_results'] if matched_ev else "N/A"
                p_copy['code_url'] = matched_ev['code_url'] if matched_ev else "N/A"
                p_copy['limitations'] = matched_ev['limitations'] if matched_ev else "N/A"
                if matched_ev and matched_ev.get('url') and not p_copy['url']:
                    p_copy['url'] = matched_ev['url']

                master_papers.append(p_copy)

        return {
            "total_candidate_inclusions": len(all_included),
            "unique_master_count": len(master_papers),
            "duplicates_eliminated": len(duplicate_matches),
            "duplicate_details": duplicate_matches,
            "master_papers": master_papers
        }
