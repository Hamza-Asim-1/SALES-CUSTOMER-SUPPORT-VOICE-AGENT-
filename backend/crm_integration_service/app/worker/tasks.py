import time
from datetime import datetime
from app.worker.celery_app import celery_app
from ..supabase_client import supabase

TABLE_NAME = "Mapped_Dataset"

@celery_app.task(bind=True)
def update_Conversation(self, row_ids):
    """
    For each row:
      - Update processing start time, task_id, and status to 'processing'
      - Call demo API to get conversation data
      - Update row with Conversation, status to 'success', and processing end time.
    """
    task_id = self.request.id
    # Assuming requests library is imported
    import requests
    import json
    
    for row_id in row_ids:
        # Record processing start time and mark row as processing
        start_time = datetime.utcnow().isoformat()
        supabase.table(TABLE_NAME).update({
            "processing_start_time": start_time,
            "task_id": task_id,
            "status": "processing"
        }).eq("User_id", row_id).execute()

        # Call the demo API to get conversation data
        try:
            # Assuming the API is on the same server, adjust URL if needed
            api_response = requests.get("http://localhost:8000/return_demo_api")
            api_data = api_response.json()
            
            # Extract conversation data and convert to string
            conversation_data = api_data.get("conversation", {})
            conversation_string = json.dumps(conversation_data)
            
            status = "success"
        except Exception as e:
            # Handle errors
            print(f"API call failed for row {row_id}: {str(e)}")
            conversation_string = f"Error retrieving conversation: {str(e)}"
            status = "error"

        # Record processing end time and update conversation/status
        end_time = datetime.utcnow().isoformat()
        supabase.table(TABLE_NAME).update({
            "Conversation": conversation_string,
            "status": status,
            "processing_end_time": end_time
        }).eq("Id", row_id).execute()

        print(f"Row {row_id} processed by task {task_id}: start {start_time}, end {end_time}.")

    return f"Task {task_id} processed {len(row_ids)} rows."



@celery_app.task
def process_dataset(user_id, num_agents=2):
    """
    - Fetch rows for the user where conversation is not set (or not 'hello').
    - Mark all those rows as 'pending'.
    - Split the row ids into chunks for the number of sales agents.
    - Dispatch an update_Conversation task for each chunk.
    """
    try:
        # Fetch rows for the given user that still need processing
        result = (
            supabase.table(TABLE_NAME)
            .select("Id, User_id, Conversation")
            .eq("User_id", user_id)
            .or_("status.is.null,status.in.(stopped,failure,pending)") 
            .execute()
        )
        rows = result.data if result.data else []
        if not rows:
            return f"No rows to process for user {user_id}."

        # Get list of row IDs
        row_ids = [row["Id"] for row in rows]

        # Mark all these rows as pending
        print(row_ids)
        pending_update = {"status": "pending"}
        for row_id in row_ids:
            supabase.table(TABLE_NAME).update(pending_update).eq("Id", row_id).execute()

        # Split row_ids into chunks to simulate dividing work among sales agents
        chunks = [row_ids[i::num_agents] for i in range(num_agents)]

        # Dispatch a Celery task for each non-empty chunk
        async_results = []
        for chunk in chunks:
            if chunk:
                result = update_Conversation.delay(chunk)
                async_results.append(result)

        task_ids = [r.id for r in async_results]
        print(f"Dispatched tasks for user {user_id}: {task_ids}")
        return {
            "user_id": user_id,
            "dispatched_tasks": task_ids,
            "total_rows": len(row_ids)
        }

    except Exception as e:
        print(f"Error processing dataset for user {user_id}: {e}")
        return {
            "user_id": user_id,
            "error": str(e),
            "dispatched_tasks": [],
            "total_rows": 0
        }
