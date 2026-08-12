from fastapi import FastAPI, HTTPException, Request
# Import your custom database connection function
from fastapi.middleware.cors import CORSMiddleware # <-- IMPORT CORS
from database import get_db_connection 
from pydantic import BaseModel # <-- 1. Import Pydantic
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

app = FastAPI()

# --- SLOWAPI LIMITER ---
# (This creates the 'limiter' variable your endpoint is looking for)
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows any frontend to connect
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"], 
)


# --- (DTO) ---
class TrialUpdateDTO(BaseModel):
    title: str
    phase: str
    status: str

# --- ENDPOINTS ---
@app.get("/")
def greet():
    return {"message": "API is running!"}

@app.get("/api/db-test")
def test_db_connection():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            return {
                "connected": True,
                "result": result[0] if result else None,
                "message": "Database connection is working."
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB connection failed: {str(e)}")

# @app.get("/api/trials")
# def get_all_trials():
#     trials = []
    
#     try:
#         # Open connection using the imported function
#         with get_db_connection() as conn:
#             cursor = conn.cursor()
            
#             # Execute the SP
#             cursor.execute("{CALL sp_GetAllTrials}")
#             rows = cursor.fetchall()
            
#             # Map the SQL rows to a Python dictionary
#             for row in rows:
#                 trials.append({
#                     "id": row.TrialId,
#                     "title": row.Title,
#                     "phase": row.Phase,
#                     "status": row.Status
#                 })
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"DB query failed: {str(e)}")
        
#     return trials

@app.get("/api/trials")
def get_all_trials(page: int = 1, limit: int = 20):
    trials = []
    total_count = 0
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Execute the new paginated SP
            cursor.execute("{CALL sp_GetTrials_Paginated (?, ?)}", (page, limit))
            rows = cursor.fetchall()
            
            for row in rows:
                total_count = row.TotalCount # Grab the total count from the window function
                trials.append({
                    "id": row.TrialId,
                    "title": row.Title,
                    "phase": row.Phase,
                    "status": row.Status
                })
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB query failed: {str(e)}")
        
    
    return {
        "data": trials,
        "current_page": page,
        "total_records": total_count,
        "total_pages": (total_count + limit - 1) // limit if total_count > 0 else 1
    }


# --- EDIT ENDPOINT ---
@app.put("/api/trials/{trial_id}")
def update_trial(trial_id: int, trial_data: TrialUpdateDTO):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Execute the SP with parameters
            # The '?' prevents SQL Injection attacks
            cursor.execute(
                "{CALL sp_UpdateTrial (?, ?, ?, ?)}", 
                (trial_id, trial_data.title, trial_data.phase, trial_data.status)
            )
            
            # IMPORTANT: For UPDATE, INSERT, and DELETE, you MUST commit the transaction!
            conn.commit()
            
            return {"message": "Trial updated successfully"}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update: {str(e)}")


# --- DELETE ENDPOINT ---
@app.delete("/api/trials/{trial_id}")
def delete_trial(trial_id: int):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Execute the Delete SP
            cursor.execute("{CALL sp_DeleteTrial (?)}", (trial_id,))
            
            # IMPORTANT: Just like UPDATE, you MUST commit the transaction!
            conn.commit()
            
            return {"message": "Trial deleted successfully"}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete: {str(e)}")



class TrialCreateDTO(BaseModel):
    title: str
    phase: str
    status: str

@app.post("/api/trials")
def add_trial(trial_data: TrialCreateDTO):
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Execute the Add SP
            # The '?' prevents SQL Injection attacks
            cursor.execute(
                "{CALL sp_AddTrial (?, ?, ?)}", 
                (trial_data.title, trial_data.phase, trial_data.status)
            )
            
            # IMPORTANT: Just like UPDATE and DELETE, you MUST commit the transaction!
            conn.commit()
            
            return {"message": "Trial added successfully"}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add: {str(e)}")


# -----RATE LIMITED STATS ENDPOINT ---
@app.get("/api/trials/stats")
@limiter.limit("3/minute")  
def get_dashboard_stats(request: Request): 
    stats = []
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("{CALL sp_GetTrialStats}")
            rows = cursor.fetchall()
            
            for row in rows:
                stats.append({
                    "phase": row.Phase,
                    "status": row.Status,
                    "count": row.TotalCount
                })
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stats query failed: {str(e)}")
        
    return stats
