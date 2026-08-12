# FastAPI + React/Vite Full-Stack Project

This repository contains a full-stack demo application with:

- A Python FastAPI backend in `backend/`
- A React frontend built with Vite in `frontend/`
- SQL Server database connectivity using `pyodbc`
- Pagination for large result sets
- Rate limiting for sensitive endpoints using `slowapi`

## Backend overview

The backend is implemented in `backend/main.py` and uses `backend/database.py` for the database connection.

### Database connection

- `backend/database.py` defines `get_db_connection()`.
- It connects to a SQL Server database using `pyodbc`.
- The connection string includes driver, server, database, user, password, and `TrustServerCertificate=yes`.

### API endpoints

The backend exposes these main endpoints:

- `GET /api/db-test`
  - Tests whether the database connection is working.
- `GET /api/trials`
  - Returns paginated trial records.
  - Supports query parameters: `page` and `limit`.
- `POST /api/trials`
  - Adds a new trial.
- `PUT /api/trials/{trial_id}`
  - Updates an existing trial.
- `DELETE /api/trials/{trial_id}`
  - Deletes a trial.
- `GET /api/trials/stats`
  - Returns trial statistics.
  - This endpoint is rate limited.

## How huge data retrieval works

When working with large tables, loading all rows into memory is inefficient and slow.
This project avoids that by using pagination.

### Pagination implementation

The `GET /api/trials` endpoint accepts:

- `page` (default: `1`)
- `limit` (default: `20`)

The backend calls a stored procedure named `sp_GetTrials_Paginated` with these two parameters:

```python
cursor.execute("{CALL sp_GetTrials_Paginated (?, ?)}", (page, limit))
```

This stored procedure should return only the requested page of rows, not the entire table.
Each row returned includes a `TotalCount` value, which is used to compute pagination metadata.

The endpoint returns a JSON object containing:

- `data`: the list of trial records for the requested page
- `current_page`: the page number
- `total_records`: total number of records in the table
- `total_pages`: the total number of pages

This structure makes it easy for the frontend to display one page at a time and fetch more pages as needed.

### Why pagination matters

For very large datasets, pagination:

- avoids long query execution times
- reduces memory usage on the server
- keeps API responses small and fast
- improves client UX by loading data incrementally

## Rate limiting with SlowAPI

This project uses `slowapi` to protect the statistics endpoint from excessive requests.

### SlowAPI setup in `backend/main.py`

- Import `Limiter`, `_rate_limit_exceeded_handler`, and `get_remote_address`.
- Create a `Limiter` instance:

```python
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

### Applying rate limits

The `GET /api/trials/stats` endpoint is decorated with:

```python
@limiter.limit("3/minute")
```

That means each client IP can only call the stats endpoint up to 3 times per minute.
If the limit is exceeded, `slowapi` returns a rate limit error automatically.

### Why rate limiting matters

Rate limiting is useful to:

- prevent abuse from repeated requests
- protect the database from heavy query load
- avoid accidental overload during spikes

## Frontend note

The frontend is a React application powered by Vite in `frontend/`.
It communicates with the FastAPI backend using the API routes described above.

## Summary

This project demonstrates a full-stack architecture where:

- backend data access is handled in Python using FastAPI and `pyodbc`
- large result sets are managed with pagination
- sensitive endpoints are protected with rate limiting via `slowapi`
- frontend and backend are separated into their own folders for clarity
