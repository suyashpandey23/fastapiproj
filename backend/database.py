import pyodbc
from fastapi import HTTPException

# --- DATABASE CONNECTION CONFIGURATION ---
DB_CONFIG = (
    "DRIVER=/opt/homebrew/Cellar/msodbcsql18/18.6.2.1/lib/libmsodbcsql.18.dylib;"
    "SERVER=127.0.0.1,1433;"
    "DATABASE=DataforFastApi;"
    "UID=sa;"
    "PWD=YourStrongPassword;" 
    "TrustServerCertificate=yes;"
)

def get_db_connection():
    """Returns a new pyodbc connection to the SQL Server database."""
    try:
        return pyodbc.connect(DB_CONFIG)
    except pyodbc.Error as e:
        print(f"Database connection error: {e}")
        raise HTTPException(status_code=500, detail="Could not connect to the database")