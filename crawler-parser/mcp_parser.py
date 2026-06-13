import os
import json
import boto3
import requests

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "meta.llama3-70b-instruct-v1:0")

# Paths
DISCOVERED_PATH = "discovered_repos.json"
DATA_DIR = "../frontend/src/data"
DB_PATH = os.path.join(DATA_DIR, "mcp_servers_data.json")

def get_bedrock_client():
    try:
        return boto3.client("bedrock-runtime", region_name=AWS_REGION)
    except Exception as e:
        print(f"Error creating Bedrock client: {e}")
        return None

def fetch_readme(full_name):
    # Try main branch first, then master
    branches = ["main", "master"]
    for branch in branches:
        url = f"https://raw.githubusercontent.com/{full_name}/{branch}/README.md"
        try:
            r = requests.get(url, timeout=5)
            if r.status_code == 200:
                # Return the first 8000 characters to stay within reasonable Bedrock context limits
                return r.text[:8000]
        except Exception:
            continue
    return None

def parse_readme_with_bedrock(bedrock_client, repo_info, readme_text):
    prompt = f"""
You are a developer assistant. Your task is to analyze the README file of an open-source Model Context Protocol (MCP) server repository and extract its configuration metadata.

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
        
        # Clean up code blocks if the model wrapped it in ```json
        if "```json" in output_text:
            output_text = output_text.split("```json")[1].split("```")[0].strip()
        elif "```" in output_text:
            output_text = output_text.split("```")[1].split("```")[0].strip()
            
        return json.loads(output_text)
    except Exception as e:
        print(f"Error parsing with Bedrock for {repo_info['full_name']}: {e}")
        return None

def main():
    print("Starting README parsing logic...")
    if not os.path.exists(DISCOVERED_PATH):
        print(f"Error: Discovered repos file '{DISCOVERED_PATH}' not found. Run crawler first.")
        return
        
    with open(DISCOVERED_PATH, "r") as f:
        discovered_repos = json.load(f)
        
    # Load existing database if it exists
    existing_db = []
    if os.path.exists(DB_PATH):
        try:
            with open(DB_PATH, "r") as f:
                existing_db = json.load(f)
            print(f"Loaded {len(existing_db)} existing parsed servers from database.")
        except Exception:
            print("Could not load existing database, starting fresh.")
            
    existing_map = {item["full_name"]: item for item in existing_db}
    
    bedrock_client = get_bedrock_client()
    if not bedrock_client:
        print("Bailing: Bedrock runtime client could not be initialized. Please check AWS configuration.")
        return
        
    parsed_count = 0
    updated_db = []
    
    # Sort discovered repos by stars descending
    discovered_repos = sorted(discovered_repos, key=lambda x: x.get("stars", 0), reverse=True)
    
    # Limit to top 15 for initial registry to stay within budget/limits, can expand later
    target_repos = discovered_repos[:15]
    print(f"Processing top {len(target_repos)} discovered repositories...")
    
    for repo in target_repos:
        full_name = repo["full_name"]
        
        # If already parsed and has high stars, keep it to save API costs
        # (Unless star count significantly updated or we want a forced refresh)
        if full_name in existing_map and repo["stars"] == existing_map[full_name].get("stars", 0):
            print(f"Skipping {full_name} (already parsed with matching stars).")
            updated_db.append(existing_map[full_name])
            continue
            
        print(f"Parsing {full_name}...")
        readme_text = fetch_readme(full_name)
        if not readme_text:
            print(f"Warning: Could not fetch README for {full_name}. Using fallback metadata.")
            # Simple fallback structured entry without Bedrock call
            fallback_entry = {
                "name": repo["name"].replace("-", " ").title(),
                "full_name": full_name,
                "html_url": repo["html_url"],
                "stars": repo["stars"],
                "description": repo["description"] if repo["description"] else "Model Context Protocol (MCP) server.",
                "category": "Developer Tools",
                "language": repo["language"],
                "installCommand": "npx -y " + repo["name"] if repo["language"] == "TypeScript" else "pip install " + repo["name"],
                "args": [],
                "envVars": [],
                "tools": [],
                "resources": []
            }
            updated_db.append(fallback_entry)
            continue
            
        parsed_data = parse_readme_with_bedrock(bedrock_client, repo, readme_text)
        if parsed_data:
            print(f"Successfully parsed {full_name} with Bedrock.")
            updated_db.append(parsed_data)
            parsed_count += 1
        else:
            # Fallback on Bedrock failure
            fallback_entry = {
                "name": repo["name"].replace("-", " ").title(),
                "full_name": full_name,
                "html_url": repo["html_url"],
                "stars": repo["stars"],
                "description": repo["description"] if repo["description"] else "Model Context Protocol (MCP) server.",
                "category": "Developer Tools",
                "language": repo["language"],
                "installCommand": "npx -y " + repo["name"] if repo["language"] == "TypeScript" else "pip install " + repo["name"],
                "args": [],
                "envVars": [],
                "tools": [],
                "resources": []
            }
            updated_db.append(fallback_entry)
            
    # Save the updated database
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(DB_PATH, "w") as f:
        json.dump(updated_db, f, indent=2)
        
    print(f"Database updated! Total servers: {len(updated_db)}. Freshly parsed: {parsed_count}.")

if __name__ == "__main__":
    main()
