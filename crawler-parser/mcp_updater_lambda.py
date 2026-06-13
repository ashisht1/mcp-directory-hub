import os
import json
import boto3
import urllib.request
import urllib.error

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "meta.llama3-70b-instruct-v1:0")
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")

def get_headers():
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "MCP-Directory-Hub-Agent"
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"
    return headers

def http_get(url, headers=None, timeout=10):
    if headers is None:
        headers = {}
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.status, response.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")
    except Exception as e:
        print(f"HTTP Request error for {url}: {e}")
        return 500, ""

def search_mcp_repositories():
    print("Searching GitHub for MCP repositories...")
    queries = [
        "topic:mcp-server",
        "topic:model-context-protocol",
        "topic:mcp-protocol"
    ]
    repos = {}
    seen_full_names = set()
    
    for q in queries:
        # urlencode query parameter
        q_encoded = urllib.parse.quote(q)
        url = f"https://api.github.com/search/repositories?q={q_encoded}&sort=stars&order=desc&per_page=30"
        try:
            status, text = http_get(url, headers=get_headers(), timeout=10)
            if status == 200:
                items = json.loads(text).get("items", [])
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
        except Exception as e:
            print(f"Exception searching GitHub for '{q}': {e}")
            
    # Parse awesome list
    awesome_repos = parse_awesome_list()
    for ar in awesome_repos[:20]:
        full_name = ar["full_name"]
        if full_name not in seen_full_names:
            seen_full_names.add(full_name)
            repo_info = fetch_repo_details(full_name)
            if repo_info:
                repos[full_name] = repo_info
            else:
                repos[full_name] = {
                    "name": full_name.split("/")[-1],
                    "full_name": full_name,
                    "html_url": f"https://github.com/{full_name}",
                    "description": ar.get("description", "Community curated MCP Server"),
                    "stars": 0,
                    "forks": 0,
                    "language": "TypeScript",
                    "owner": full_name.split("/")[0]
                }
                
    return list(repos.values())

def parse_awesome_list():
    url = "https://raw.githubusercontent.com/appcypher/awesome-mcp-servers/main/README.md"
    repos = []
    try:
        status, text = http_get(url, timeout=10)
        if status == 200:
            lines = text.split("\n")
            for line in lines:
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
    except Exception as e:
        print(f"Error fetching awesome list: {e}")
    return repos

def fetch_repo_details(full_name):
    url = f"https://api.github.com/repos/{full_name}"
    try:
        status, text = http_get(url, headers=get_headers(), timeout=5)
        if status == 200:
            item = json.loads(text)
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

def fetch_readme(full_name):
    branches = ["main", "master"]
    for branch in branches:
        url = f"https://raw.githubusercontent.com/{full_name}/{branch}/README.md"
        try:
            status, text = http_get(url, timeout=5)
            if status == 200:
                return text[:8000]
        except Exception:
            continue
    return None

def parse_readme_with_bedrock(bedrock_client, repo_info, readme_text):
    prompt = f"""
You are a developer assistant. Your task is to analyze the README file of an open-source Model Context Protocol (MCP) server repository, extract configuration metadata, and classify it by target user segment.

Repository Info:
Name: {repo_info['name']}
Owner: {repo_info['owner']}
URL: {repo_info['html_url']}
Raw Description: {repo_info['description']}

README Content Snippet:
---
{readme_text}
---

Your output MUST be a valid JSON object matching the following structure. Do not include any explanation, markdown formatting, or HTML tags outside the JSON block. Return ONLY the JSON object.

JSON Schema:
{{
  "name": "Human Readable Name (e.g. Postgres Database Connector)",
  "full_name": "{repo_info['full_name']}",
  "html_url": "{repo_info['html_url']}",
  "stars": {repo_info['stars']},
  "description": "A clear, engaging 2-3 sentence description of what the server does.",
  "category": "Pick exactly one from: 'Databases', 'Developer Tools', 'Web & Browsing', 'Productivity & Communication', 'AI & Knowledge', 'Other'",
  "target_user_segment": "Pick exactly one from: 'developer' (coders/DevOps), 'analyst' (data/researchers), 'creator' (content/marketing), 'investor' (finance/portfolio), 'general' (everyday surfers)",
  "language": "Primary programming language of the codebase (e.g., 'TypeScript', 'Python', 'Go', 'Rust')",
  "installCommand": "The base command to run or execute the server (e.g., 'npx -y @modelcontextprotocol/server-postgres', 'uvx mcp-server-git', or a docker run command)",
  "args": ["A list of command line arguments required to run it. Use capital placeholders in angle brackets like '<POSTGRES_URL>' for configuration variables"],
  "envVars": [
    {{
      "name": "Name of the environment variable (e.g. GITHUB_PERSONAL_ACCESS_TOKEN)",
      "description": "What this variable is used for",
      "required": true,
      "placeholder": "A placeholder value (e.g. ghp_yourTokenHere)"
    }}
  ],
  "tools": ["List of tools this server provides (e.g. 'read_file', 'query', 'search_web')"],
  "resources": ["List of resources this server provides (if mentioned in README, otherwise empty list)"]
}}
"""
    try:
        response = bedrock_client.converse(
            modelId=BEDROCK_MODEL_ID,
            messages=[{
                "role": "user",
                "content": [{"text": prompt}]
            }],
            inferenceConfig={
                "maxTokens": 2048,
                "temperature": 0.1
            }
        )
        output_text = response['output']['message']['content'][0]['text'].strip()
        
        if "```json" in output_text:
            output_text = output_text.split("```json")[1].split("```")[0].strip()
        elif "```" in output_text:
            output_text = output_text.split("```")[1].split("```")[0].strip()
            
        return json.loads(output_text)
    except Exception as e:
        print(f"Error parsing with Bedrock for {repo_info['full_name']}: {e}")
        return None

def lambda_handler(event, context):
    print("Starting MCP Registry Scheduled Update...")
    
    if not S3_BUCKET_NAME:
        print("Error: S3_BUCKET_NAME environment variable not set.")
        return {"statusCode": 500, "body": "S3_BUCKET_NAME not configured."}
        
    s3_client = boto3.client("s3")
    
    # Load existing database from S3 if it exists
    existing_db = []
    try:
        response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key="mcp_servers_data.json")
        existing_db = json.loads(response["Body"].read().decode("utf-8"))
        print(f"Loaded {len(existing_db)} existing parsed servers from S3.")
    except Exception as e:
        print(f"No existing database found in S3 or failed to load: {e}. Starting fresh.")
        
    existing_map = {item["full_name"]: item for item in existing_db}
    
    # Run GitHub crawler
    discovered_repos = search_mcp_repositories()
    discovered_repos = sorted(discovered_repos, key=lambda x: x.get("stars", 0), reverse=True)
    
    # Limit to top 15 repositories
    target_repos = discovered_repos[:15]
    print(f"Processing top {len(target_repos)} discovered repositories...")
    
    bedrock_client = boto3.client("bedrock-runtime", region_name=AWS_REGION)
    updated_db = []
    parsed_count = 0
    
    for repo in target_repos:
        full_name = repo["full_name"]
        
        if full_name in existing_map and repo["stars"] == existing_map[full_name].get("stars", 0):
            print(f"Reusing parsed data for {full_name}.")
            if "target_user_segment" in existing_map[full_name]:
                updated_db.append(existing_map[full_name])
                continue
                
        print(f"Parsing {full_name}...")
        readme_text = fetch_readme(full_name)
        if not readme_text:
            fallback = {
                "name": repo["name"].replace("-", " ").title(),
                "full_name": full_name,
                "html_url": repo["html_url"],
                "stars": repo["stars"],
                "description": repo["description"] if repo["description"] else "Model Context Protocol (MCP) server.",
                "category": "Developer Tools",
                "target_user_segment": "developer",
                "language": repo["language"],
                "installCommand": "npx -y " + repo["name"] if repo["language"] == "TypeScript" else "pip install " + repo["name"],
                "args": [],
                "envVars": [],
                "tools": [],
                "resources": []
            }
            updated_db.append(fallback)
            continue
            
        parsed_data = parse_readme_with_bedrock(bedrock_client, repo, readme_text)
        if parsed_data:
            updated_db.append(parsed_data)
            parsed_count += 1
        else:
            fallback = {
                "name": repo["name"].replace("-", " ").title(),
                "full_name": full_name,
                "html_url": repo["html_url"],
                "stars": repo["stars"],
                "description": repo["description"] if repo["description"] else "Model Context Protocol (MCP) server.",
                "category": "Developer Tools",
                "target_user_segment": "developer",
                "language": repo["language"],
                "installCommand": "npx -y " + repo["name"] if repo["language"] == "TypeScript" else "pip install " + repo["name"],
                "args": [],
                "envVars": [],
                "tools": [],
                "resources": []
            }
            updated_db.append(fallback)

    # Save to S3
    try:
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key="mcp_servers_data.json",
            Body=json.dumps(updated_db, indent=2),
            ContentType="application/json"
        )
        print(f"Successfully uploaded mcp_servers_data.json to S3 bucket {S3_BUCKET_NAME}.")
    except Exception as e:
        print(f"Error uploading database to S3: {e}")
        return {"statusCode": 500, "body": f"Failed to upload database: {e}"}
        
    return {
        "statusCode": 200,
        "body": json.dumps(f"Database updated. Total: {len(updated_db)}. Freshly parsed: {parsed_count}.")
    }

if __name__ == "__main__":
    print("Mock execution testing...")
    import sys
    # Verify GitHub crawler works locally with urllib
    repos = search_mcp_repositories()
    print(f"urllib crawler found {len(repos)} repos.")
