import os
import json
import boto3
from datetime import datetime

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "meta.llama3-70b-instruct-v1:0")
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME")

def get_current_timestamp():
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

def update_agent_status(s3_client, agent_name, status, message):
    if not S3_BUCKET_NAME:
        return
    status_key = "mcp_agents_status.json"
    
    # Load existing status
    current_status = {}
    try:
        response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=status_key)
        current_status = json.loads(response["Body"].read().decode("utf-8"))
    except Exception:
        print("Creating new agent status log file.")
        
    current_status[agent_name] = {
        "last_run": get_current_timestamp(),
        "status": status,
        "message": message
    }
    
    try:
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=status_key,
            Body=json.dumps(current_status, indent=2),
            ContentType="application/json"
        )
    except Exception as e:
        print(f"Error writing agent status to S3: {e}")

def audit_server_with_bedrock(bedrock_client, server):
    prompt = f"""
You are an expert quality assurance auditor for a Model Context Protocol (MCP) server registry. 
Your job is to inspect an MCP server entry, check for invalid or inconsistent classification tags, and recommend corrections.

Server details to audit:
JSON:
{json.dumps(server, indent=2)}

Verification Guidelines:
1. Category must be exactly one of: 'Databases', 'Developer Tools', 'Web & Browsing', 'Productivity & Communication', 'AI & Knowledge', 'Other'
2. Target User Segment must be exactly one of: 'developer' (coders/DevOps), 'analyst' (data/researchers), 'creator' (content/marketing), 'investor' (finance/portfolio), 'general' (everyday surfers)
3. Ensure the category and target segment match the server's description (e.g. database connectors should be under 'Databases' and target 'analyst' or 'developer'; calendar/email tools should be 'Productivity & Communication' and target 'general').

Output your findings as a JSON object with this exact format:
{{
  "corrections": [
    {{
      "field": "The field needing correction (e.g. 'category' or 'target_user_segment')",
      "old": "The current incorrect value",
      "new": "The corrected value",
      "reason": "Clear explanation of why this change was made"
    }}
  ]
}}
If no corrections are needed, output an empty list for "corrections". Do not include any explanations outside the JSON block. Return ONLY the JSON object.
"""
    try:
        response = bedrock_client.converse(
            modelId=BEDROCK_MODEL_ID,
            messages=[{
                "role": "user",
                "content": [{"text": prompt}]
            }],
            inferenceConfig={
                "maxTokens": 1024,
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
        print(f"Bedrock audit failed for {server.get('full_name', 'unknown')}: {e}")
        return {"corrections": []}

def lambda_handler(event, context):
    print("Starting MCP Quality Audit...")
    
    if not S3_BUCKET_NAME:
        print("Error: S3_BUCKET_NAME environment variable not set.")
        return {"statusCode": 500, "body": "S3_BUCKET_NAME not configured."}
        
    s3_client = boto3.client("s3")
    bedrock_client = boto3.client("bedrock-runtime", region_name=AWS_REGION)
    
    # 1. Load registry database
    try:
        response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key="mcp_servers_data.json")
        servers = json.loads(response["Body"].read().decode("utf-8"))
    except Exception as e:
        msg = f"Failed to retrieve servers database from S3: {e}"
        print(msg)
        update_agent_status(s3_client, "auditor", "failure", msg)
        return {"statusCode": 500, "body": msg}
        
    print(f"Loaded {len(servers)} servers to audit.")
    
    audit_details = []
    corrections_count = 0
    updated_servers = []
    
    # 2. Audit each server
    for server in servers:
        repo_name = server.get("full_name", "unknown")
        print(f"Auditing {repo_name}...")
        
        # Bedrock LLM classification check
        audit_result = audit_server_with_bedrock(bedrock_client, server)
        corrections = audit_result.get("corrections", [])
        
        if corrections:
            modified_server = dict(server)
            applied_corrections = []
            for corr in corrections:
                field = corr.get("field")
                new_val = corr.get("new")
                if field in modified_server:
                    print(f"Correcting {field} on {repo_name} from '{modified_server[field]}' to '{new_val}'")
                    modified_server[field] = new_val
                    applied_corrections.append(corr)
                    corrections_count += 1
            
            if applied_corrections:
                audit_details.append({
                    "repo": repo_name,
                    "corrections": applied_corrections
                })
                updated_servers.append(modified_server)
                continue
                
        updated_servers.append(server)
        
    # 3. Save updated database back to S3 if any corrections were made
    if corrections_count > 0:
        try:
            s3_client.put_object(
                Bucket=S3_BUCKET_NAME,
                Key="mcp_servers_data.json",
                Body=json.dumps(updated_servers, indent=2),
                ContentType="application/json"
            )
            print(f"Successfully uploaded corrected mcp_servers_data.json to S3.")
        except Exception as e:
            msg = f"Failed to upload corrected database: {e}"
            print(msg)
            update_agent_status(s3_client, "auditor", "failure", msg)
            return {"statusCode": 500, "body": msg}
            
    # 4. Save audit report to S3
    report = {
        "last_audit_run": get_current_timestamp(),
        "status": "success",
        "total_audited": len(servers),
        "corrections_made": corrections_count,
        "details": audit_details
    }
    
    try:
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key="mcp_audit_report.json",
            Body=json.dumps(report, indent=2),
            ContentType="application/json"
        )
        print("Successfully uploaded mcp_audit_report.json to S3.")
    except Exception as e:
        print(f"Failed to upload audit report: {e}")
        
    # 5. Log auditor success status
    msg = f"Audited {len(servers)} servers. Made {corrections_count} corrections."
    update_agent_status(s3_client, "auditor", "success", msg)
    
    return {
        "statusCode": 200,
        "body": json.dumps(msg)
    }

if __name__ == "__main__":
    print("Mock auditor run...")
