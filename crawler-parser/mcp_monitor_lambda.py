import os
import json
import boto3
import urllib.request
from datetime import datetime, timedelta

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME")
VERCEL_URL = os.environ.get("VERCEL_URL", "https://frontend-six-rose-30.vercel.app")
ALERT_EMAIL = os.environ.get("ALERT_EMAIL", "ashishtehri@gmail.com") # Default to ashishtehri@gmail.com, configurable via environment

def get_current_timestamp():
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

def update_agent_status(s3_client, agent_name, status, message):
    if not S3_BUCKET_NAME:
        return
    status_key = "mcp_agents_status.json"
    
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

def send_alert_email(failed_checks):
    ses_client = boto3.client("ses", region_name=AWS_REGION)
    
    subject = "⚠️ ALERT: MCP Registry Hub Issues Detected"
    
    body_text = f"""
Dear User,

The MCP Registry Hub Monitoring Agent has detected issues during its health checks.

Failed Checks:
"""
    for check, detail in failed_checks.items():
        body_text += f"- {check}: {detail}\n"
        
    body_text += f"\nTimestamp (UTC): {get_current_timestamp()}\nS3 Bucket: {S3_BUCKET_NAME}\nVercel Site: {VERCEL_URL}\n\nPlease inspect the status dashboard on the website or AWS CloudWatch logs for more details."
    
    try:
        response = ses_client.send_email(
            Source=ALERT_EMAIL,
            Destination={
                "ToAddresses": [ALERT_EMAIL]
            },
            Message={
                "Subject": {
                    "Data": subject
                },
                "Body": {
                    "Text": {
                        "Data": body_text
                    }
                }
            }
        )
        print(f"Alert email sent successfully. Message ID: {response['MessageId']}")
        return True
    except Exception as e:
        print(f"Failed to send alert email via SES: {e}")
        print("NOTE: Ensure both sender and receiver emails are verified in the AWS SES console.")
        return False

def lambda_handler(event, context):
    print("Starting MCP Registry Health Monitor...")
    
    if not S3_BUCKET_NAME:
        print("Error: S3_BUCKET_NAME environment variable not set.")
        return {"statusCode": 500, "body": "S3_BUCKET_NAME not configured."}
        
    s3_client = boto3.client("s3")
    failed_checks = {}
    
    # 1. Ping Vercel URL
    try:
        req = urllib.request.Request(VERCEL_URL, headers={"User-Agent": "MCP-Registry-Monitor"})
        with urllib.request.urlopen(req, timeout=10) as response:
            status = response.status
            if status != 200:
                failed_checks["Vercel URL Ping"] = f"Site returned status code {status} instead of 200."
    except Exception as e:
        failed_checks["Vercel URL Ping"] = f"Failed to connect to Vercel site: {e}"
        
    # 2. Check S3 database file & Validate Pagination
    try:
        response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key="mcp_servers_data.json")
        data = json.loads(response["Body"].read().decode("utf-8"))
        if not isinstance(data, list) or len(data) == 0:
            failed_checks["S3 Registry Database"] = "Database is empty or not a valid JSON list."
        else:
            # Validate pagination condition (at least one page has tools)
            items_per_page = 6
            print(f"Validation Layer: Verified database contains {len(data)} tools.")
            if len(data) > items_per_page:
                print(f"Validation Layer: Pagination is active (database size {len(data)} > page size {items_per_page}).")
    except Exception as e:
        failed_checks["S3 Registry Database"] = f"Failed to retrieve/validate database file: {e}"
        
    # 3. Check Agent Freshness
    try:
        status_response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key="mcp_agents_status.json")
        agent_status = json.loads(status_response["Body"].read().decode("utf-8"))
        
        now = datetime.utcnow()
        for agent_name in ["updater", "auditor"]:
            agent_data = agent_status.get(agent_name)
            if not agent_data:
                failed_checks[f"{agent_name.capitalize()} Agent Run"] = "No status information recorded."
                continue
                
            last_run_str = agent_data.get("last_run")
            status = agent_data.get("status")
            
            if status != "success":
                failed_checks[f"{agent_name.capitalize()} Agent Run"] = f"Last run failed: {agent_data.get('message', 'unknown error')}"
                continue
                
            last_run = datetime.strptime(last_run_str, "%Y-%m-%dT%H:%M:%SZ")
            if now - last_run > timedelta(hours=26): # Allow 2 hours grace period beyond 24h
                failed_checks[f"{agent_name.capitalize()} Agent Freshness"] = f"Last successful run was at {last_run_str} (over 26 hours ago)."
    except Exception as e:
        failed_checks["Agent Status Logs"] = f"Failed to verify agent statuses: {e}"
        
    # 4. Handle Alerts
    if failed_checks:
        print("Health checks failed. Issues detected:")
        for check, detail in failed_checks.items():
            print(f"- {check}: {detail}")
            
        email_sent = send_alert_email(failed_checks)
        status_msg = f"Health checks failed. Issues: {list(failed_checks.keys())}. Email alert sent: {email_sent}."
        update_agent_status(s3_client, "monitor", "failure", status_msg)
        
        return {
            "statusCode": 200,
            "body": json.dumps({
                "healthy": False,
                "failed_checks": failed_checks,
                "email_sent": email_sent
            })
        }
        
    print("All health checks passed successfully!")
    update_agent_status(s3_client, "monitor", "success", "All health checks passed successfully.")
    
    return {
        "statusCode": 200,
        "body": json.dumps({
            "healthy": True,
            "failed_checks": {}
        })
    }

if __name__ == "__main__":
    print("Mock monitor run...")
