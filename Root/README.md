# AI User Complaint MS

This workspace contains a Vite + React frontend and a FastAPI backend for complaint intake and triage.

## Frontend

The UI lives in [frontend-react-redux-ui](frontend-react-redux-ui).

Run it with:

```bash
npm install
npm run dev
```

## Backend

The API lives in [backend](backend).

Create a virtual environment, then install dependencies and run FastAPI:

```bash
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r backend\requirements.txt
python -m uvicorn app.main:app --reload --app-dir backend
```

## Frontend API Config

Copy [frontend-react-redux-ui/.env.example](frontend-react-redux-ui/.env.example) to [frontend-react-redux-ui/.env.local](frontend-react-redux-ui/.env.local) and adjust `VITE_BACKEND_URL` if needed.
