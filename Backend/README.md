# FastAPI backend

## Setup

1. Create and activate a virtual environment.
2. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
3. Copy [backend/.env.example](backend/.env.example) to [backend/.env](backend/.env) and set `DATABASE_URL` for your PostgreSQL server.
4. Run the API:
   ```bash
   python -m uvicorn app.main:app --reload --app-dir backend
   ```

## Endpoints

- `GET /health` - basic health check.
- `POST /analyze` - analyze complaint text and return extracted fields plus a risk summary.

The analyze endpoint stores each request in PostgreSQL.
