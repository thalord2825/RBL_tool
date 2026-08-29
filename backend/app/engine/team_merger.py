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
        authors_map = {}
        venue_map = {}
        doi_url_map = {}
        abstract_map = {}

        # 1. Parse all evidence tables and extract venues & URLs
        for m in cls.MEMBERS:
            ev_file = os.path.join(repo_path, m, "SLR", "evidence-table.md")
            m_ev = cls.parse_evidence_table(ev_file)
            global_evidence_map.update(m_ev)
            
            # Extract venue and url from evidence markdown lines
            if os.path.exists(ev_file):
                with open(ev_file, 'r', encoding='utf-8', errors='ignore') as f:
                    for line in f:
                        if '|' in line and not line.strip().startswith('| ID') and not line.strip().startswith('| :--'):
                            parts = [c.strip() for c in line.split('|')[1:-1]]
                            if len(parts) >= 2:
                                paper_cell = parts[1]
                                t_m = re.search(r'\[([^\]]+)\]\(([^)]+)\)\s*(?:\((?:(\d{4}),\s*)?([^\)]+)\))?', paper_cell)
                                if t_m:
                                    t = t_m.group(1).strip()
                                    u = t_m.group(2).strip()
                                    v = (t_m.group(4) or '').strip().strip('_*')
                                    norm_t = DeduplicationEngine.normalize_title(t)
                                    if u and u.lower() not in ['n/a', 'none', '']:
                                        doi_url_map[norm_t] = u
                                    if v and v.lower() not in ['n/a', 'none', '']:
                                        venue_map[norm_t] = v

        # 2. Collect metadata & abstracts from all records across members
        for m in cls.MEMBERS:
            for fname in ["01_all_records.csv", "02_after_screening_v1.csv"]:
                f_path = os.path.join(repo_path, m, "SLR", fname)
                if os.path.exists(f_path):
                    with open(f_path, 'r', encoding='utf-8', errors='ignore') as f:
                        reader = csv.DictReader(f)
                        for row in reader:
                            t = (row.get('title') or row.get('Title') or '').strip()
                            if not t:
                                continue
                            norm_t = DeduplicationEngine.normalize_title(t)
                            
                            auth = (row.get('authors') or row.get('Authors') or '').strip()
                            if auth and auth.lower() not in ["n/a", "none", "unknown authors", ""]:
                                if norm_t not in authors_map:
                                    authors_map[norm_t] = auth
                                    
                            ven = (row.get('venue') or row.get('Venue') or '').strip()
                            if ven and ven.lower() not in ["n/a", "none", ""]:
                                if norm_t not in venue_map:
                                    venue_map[norm_t] = ven
                                    
                            du = (row.get('doi_or_url') or row.get('url_or_doi') or row.get('doi') or row.get('url') or '').strip()
                            if du and du.lower() not in ["n/a", "none", ""]:
                                if norm_t not in doi_url_map:
                                    doi_url_map[norm_t] = du

                            ab = (row.get('abstract') or row.get('Abstract') or '').strip()
                            if ab and ab.lower() not in ["n/a", "none", ""]:
                                if norm_t not in abstract_map:
                                    abstract_map[norm_t] = ab

        # 3. Collect rich metadata from markdown summary cards in papers/
        for m in cls.MEMBERS:
            p_dir = os.path.join(repo_path, m, "SLR", "papers")
            if os.path.exists(p_dir):
                for fname in os.listdir(p_dir):
                    if fname.endswith('.md'):
                        fpath = os.path.join(p_dir, fname)
                        with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                            t_match = re.search(r'\*\*Title:\*\*\s*(.+)', content)
                            if t_match:
                                t = t_match.group(1).strip()
                                norm_t = DeduplicationEngine.normalize_title(t)
                                auth_m = re.search(r'\*\*Authors:\*\*\s*(.+)', content)
                                if auth_m and auth_m.group(1).strip():
                                    authors_map[norm_t] = auth_m.group(1).strip()
                                ven_m = re.search(r'\*\*Venue:\*\*\s*(.+)', content)
                                if ven_m and ven_m.group(1).strip():
                                    venue_map[norm_t] = ven_m.group(1).strip()
                                url_m = re.search(r'\*\*Verified Link:\*\*\s*(.+)', content)
                                if url_m and url_m.group(1).strip():
                                    doi_url_map[norm_t] = url_m.group(1).strip()
                                ab_m = re.search(r'## Abstract\s*\n+([\s\S]+?)(?=\n##|\Z)', content)
                                if ab_m and ab_m.group(1).strip():
                                    abstract_map[norm_t] = ab_m.group(1).strip()

        # 4. Collect included papers from 03_final_included.csv
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
                            "original_id": r.get('id') or r.get('ID') or r.get('paper_id') or 'N/A',
                            "member": m,
                            "title": title,
                            "authors": (r.get('authors') or r.get('Authors') or 'N/A').strip(),
                            "year": int(r.get('year') or r.get('Year') or 2024),
                            "venue": (r.get('venue') or r.get('Venue') or 'N/A').strip(),
                            "doi": (r.get('doi') or r.get('DOI') or 'N/A').strip(),
                            "url": (r.get('url') or r.get('URL') or r.get('url_or_doi') or '').strip(),
                            "abstract": (r.get('abstract') or r.get('Abstract') or '').strip(),
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
                p_copy['id'] = p_copy['master_id']
                p_copy['contributors'] = [p['member']]

                # Attach evidence
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

                # Enrich Authors
                if not p_copy.get('authors') or p_copy.get('authors') in ['N/A', '', 'Unknown Authors']:
                    if p_norm_title in authors_map:
                        p_copy['authors'] = authors_map[p_norm_title]
                    else:
                        for ak, av in authors_map.items():
                            if DeduplicationEngine.title_similarity(p['title'], ak) >= 0.88:
                                p_copy['authors'] = av
                                break

                # Enrich Venue
                if not p_copy.get('venue') or p_copy.get('venue') in ['N/A', '', 'None']:
                    if p_norm_title in venue_map:
                        p_copy['venue'] = venue_map[p_norm_title]
                    else:
                        for vk, vv in venue_map.items():
                            if DeduplicationEngine.title_similarity(p['title'], vk) >= 0.88:
                                p_copy['venue'] = vv
                                break

                # Enrich URL / DOI
                if not p_copy.get('url') or p_copy.get('url') == '':
                    if matched_ev and matched_ev.get('url'):
                        p_copy['url'] = matched_ev['url']
                    elif p_norm_title in doi_url_map:
                        p_copy['url'] = doi_url_map[p_norm_title]
                    else:
                        for dk, dv in doi_url_map.items():
                            if DeduplicationEngine.title_similarity(p['title'], dk) >= 0.88:
                                p_copy['url'] = dv
                                break

                # Enrich Abstract
                if not p_copy.get('abstract') or p_copy.get('abstract').lower() in ["n/a", "none", ""]:
                    if p_norm_title in abstract_map:
                        p_copy['abstract'] = abstract_map[p_norm_title]
                    else:
                        for ab_k, ab_v in abstract_map.items():
                            if DeduplicationEngine.title_similarity(p['title'], ab_k) >= 0.88:
                                p_copy['abstract'] = ab_v
                                break

                if not p_copy.get('abstract'):
                    p_copy['abstract'] = "N/A"

                master_papers.append(p_copy)

        return {
            "total_candidate_inclusions": len(all_included),
            "unique_master_count": len(master_papers),
            "duplicates_eliminated": len(duplicate_matches),
            "duplicate_details": duplicate_matches,
            "master_papers": master_papers
        }
