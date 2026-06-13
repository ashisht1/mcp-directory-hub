import os
import requests
import json

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")

def get_headers():
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "MCP-Directory-Hub-Agent"
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"
    return headers

def search_mcp_repositories():
    print("Searching GitHub for MCP repositories...")
    queries = [
        "topic:mcp-server",
        "topic:model-context-protocol",
        "topic:mcp-protocol"
    ]
    repos = {}
    
    # Track full names to prevent duplicates
    seen_full_names = set()
    
    for q in queries:
        url = f"https://api.github.com/search/repositories?q={q}&sort=stars&order=desc&per_page=50"
        try:
            r = requests.get(url, headers=get_headers(), timeout=10)
            if r.status_code == 200:
                items = r.json().get("items", [])
                print(f"Query '{q}' found {len(items)} repositories.")
                for item in items:
                    full_name = item["full_name"]
                    if full_name not in seen_full_names:
                        seen_full_names.add(full_name)
                        repos[full_name] = {
                            "name": item["name"],
                            "full_name": full_name,
                            "html_url": item["html_url"],
                            "description": item["description"],
                            "stars": item["stargazers_count"],
                            "forks": item["forks_count"],
                            "language": item["language"] if item["language"] else "TypeScript",
                            "owner": item["owner"]["login"]
                        }
            else:
                print(f"Error querying GitHub Search API for '{q}': Status {r.status_code}")
        except Exception as e:
            print(f"Exception searching GitHub for '{q}': {e}")
            
    # Also parse community awesome list to discover more servers
    awesome_repos = parse_awesome_list()
    for ar in awesome_repos:
        full_name = ar["full_name"]
        if full_name not in seen_full_names:
            seen_full_names.add(full_name)
            # Try fetching repository details from API
            repo_info = fetch_repo_details(full_name)
            if repo_info:
                repos[full_name] = repo_info
            else:
                # Fallback if API fails or is rate-limited
                repos[full_name] = {
                    "name": full_name.split("/")[-1],
                    "full_name": full_name,
                    "html_url": f"https://github.com/{full_name}",
                    "description": ar.get("description", "Community curated MCP Server"),
                    "stars": 0,
                    "forks": 0,
                    "language": "TypeScript", # TypeScript is the ecosystem default
                    "owner": full_name.split("/")[0]
                }
                
    return list(repos.values())

def parse_awesome_list():
    print("Fetching community awesome-mcp-servers list...")
    url = "https://raw.githubusercontent.com/appcypher/awesome-mcp-servers/main/README.md"
    repos = []
    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            lines = r.text.split("\n")
            for line in lines:
                # Search for github links in markdown list items
                if "github.com/" in line and "- [" in line:
                    try:
                        parts = line.split("github.com/")
                        if len(parts) > 1:
                            path = parts[1].split(")")[0].split(" ")[0].strip()
                            path_parts = [p for p in path.split("/") if p]
                            if len(path_parts) >= 2:
                                full_name = f"{path_parts[0]}/{path_parts[1]}"
                                description = ""
                                if " - " in line:
                                    description = line.split(" - ")[-1].strip()
                                repos.append({
                                    "full_name": full_name,
                                    "description": description
                                })
                    except Exception:
                        continue
            print(f"Extracted {len(repos)} repositories from awesome list.")
        else:
            print(f"Could not fetch awesome list: HTTP {r.status_code}")
    except Exception as e:
        print(f"Error fetching awesome list: {e}")
    return repos

def fetch_repo_details(full_name):
    url = f"https://api.github.com/repos/{full_name}"
    try:
        r = requests.get(url, headers=get_headers(), timeout=5)
        if r.status_code == 200:
            item = r.json()
            return {
                "name": item["name"],
                "full_name": item["full_name"],
                "html_url": item["html_url"],
                "description": item["description"],
                "stars": item["stargazers_count"],
                "forks": item["forks_count"],
                "language": item["language"] if item["language"] else "TypeScript",
                "owner": item["owner"]["login"]
            }
    except Exception:
        pass
    return None

if __name__ == "__main__":
    repos = search_mcp_repositories()
    print(f"Discovered {len(repos)} unique MCP server repositories.")
    with open("discovered_repos.json", "w") as f:
        json.dump(repos, f, indent=2)
