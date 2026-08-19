import requests
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class GitHubAtomicCommitter:
    @staticmethod
    def commit_all_files(
        files_dict: Dict[str, str],
        repo_owner: str,
        repo_name: str,
        branch: str,
        member_path: str,
        commit_prefix: str,
        github_token: str
    ) -> Dict[str, Any]:
        """
        Executes a single atomic commit containing all files using GitHub Git Database Trees API.
        """
        if not github_token:
            raise ValueError("GitHub Personal Access Token (PAT) is required for Git commit.")

        headers = {
            "Authorization": f"Bearer {github_token}",
            "Accept": "application/vnd.github.v3+json"
        }
        base_api = f"https://api.github.com/repos/{repo_owner}/{repo_name}"

        # Step 1: Get latest commit SHA on the target branch
        ref_url = f"{base_api}/git/ref/heads/{branch}"
        ref_res = requests.get(ref_url, headers=headers)
        if ref_res.status_code != 200:
            raise Exception(f"Failed to fetch branch ref '{branch}' from {repo_owner}/{repo_name}: {ref_res.text}")
        
        latest_commit_sha = ref_res.json()["object"]["sha"]

        # Step 2: Get base tree SHA from the latest commit
        commit_url = f"{base_api}/git/commits/{latest_commit_sha}"
        commit_res = requests.get(commit_url, headers=headers)
        if commit_res.status_code != 200:
            raise Exception(f"Failed to fetch commit object {latest_commit_sha}: {commit_res.text}")
        
        base_tree_sha = commit_res.json()["tree"]["sha"]

        # Step 3: Construct Tree items for all files
        # Ensure member_path has trailing slash
        clean_path = member_path.strip().strip("/")
        tree_items = []
        for filename, content in files_dict.items():
            file_path = f"{clean_path}/{filename}" if clean_path else filename
            tree_items.append({
                "path": file_path,
                "mode": "100644",
                "type": "blob",
                "content": content
            })

        # Step 4: Post new tree
        tree_url = f"{base_api}/git/trees"
        tree_payload = {
            "base_tree": base_tree_sha,
            "tree": tree_items
        }
        tree_res = requests.post(tree_url, headers=headers, json=tree_payload)
        if tree_res.status_code != 201:
            raise Exception(f"Failed to create Git Tree: {tree_res.text}")
        
        new_tree_sha = tree_res.json()["sha"]

        # Step 5: Create a new Commit
        prefix = commit_prefix.strip() if commit_prefix else "[SLR]"
        commit_msg = f"{prefix} Update Systematic Literature Review deliverables ({len(files_dict)} files)"
        
        new_commit_url = f"{base_api}/git/commits"
        new_commit_payload = {
            "message": commit_msg,
            "tree": new_tree_sha,
            "parents": [latest_commit_sha]
        }
        new_commit_res = requests.post(new_commit_url, headers=headers, json=new_commit_payload)
        if new_commit_res.status_code != 201:
            raise Exception(f"Failed to create new Commit: {new_commit_res.text}")
        
        new_commit_sha = new_commit_res.json()["sha"]

        # Step 6: Update branch ref to point to the new commit
        update_ref_res = requests.patch(ref_url, headers=headers, json={"sha": new_commit_sha})
        if update_ref_res.status_code != 200:
            raise Exception(f"Failed to update branch ref to {new_commit_sha}: {update_ref_res.text}")

        return {
            "status": "success",
            "commit_sha": new_commit_sha,
            "commit_url": f"https://github.com/{repo_owner}/{repo_name}/commit/{new_commit_sha}",
            "files_committed": list(files_dict.keys()),
            "message": f"Successfully created 1 Single Atomic Commit ({new_commit_sha[:7]}) containing {len(files_dict)} files."
        }
