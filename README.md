# CiviX – AI-Powered Smart Municipal Management Platform

An AI-powered civic platform designed to help citizens report, track, and resolve community infrastructure issues (potholes, streetlights, garbage, water leaks) using a multi-agent AI system powered by Google Gemini, OpenStreetMap, and Firebase.

---

## Project Structure

Our repository follows Clean Architecture principles:

```
busy-noether/
├── frontend/             # React + Vite + TypeScript + Tailwind CSS v4
│   ├── src/
│   │   ├── components/   # Reusable UI elements
│   │   ├── services/     # API Client & Firebase Client Config
│   │   ├── store/        # Zustand global state stores
│   │   └── App.tsx       # Live status dashboard & chat sandbox
│   ├── .env.example      # Frontend env variables template
│   └── package.json      # NPM scripts and dependencies
├── backend/              # FastAPI Python service layer
│   ├── app/
│   │   ├── api/          # Route routers & dependency injections
│   │   ├── core/         # Settings loading & Firebase Admin Config
│   │   ├── services/     # Gemini GenAI Client wrapper
│   │   ├── agents/       # Multi-agent pipelines (Vision, Classifier, Priority)
│   │   └── main.py       # ASGI app entrypoint
│   ├── .env.example      # Backend env variables template
│   └── requirements.txt  # Python requirements
├── .gitignore            # Multi-environment exclusions
└── README.md             # This instructions file
```

---

## Getting Started

### 1. Backend Setup (FastAPI)

Ensure Python 3.12+ is installed on your machine.

```bash
# Navigate to backend folder
cd backend

# Create a virtual environment
python -m venv venv

# Activate the environment (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Activate the environment (macOS/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the FastAPI server in hot reload mode
uvicorn app.main:app --reload --port 8000
```

The backend server will run at `http://localhost:8000`. You can inspect the interactive OpenAPI documentation at `http://localhost:8000/docs`.

### 2. Frontend Setup (React + Vite)

Ensure Node.js 18+ is installed on your machine.

```bash
# Navigate to frontend folder
cd ../frontend

# Install node dependencies
npm install

# Run the local development server
npm run dev
```

The frontend will run at `http://localhost:5173`. Open this URL in your web browser.

---

## Environment Variables Configuration

- **Backend:** Copy `backend/.env.example` to `backend/.env` and update credentials for `GEMINI_API_KEY` and Firebase service accounts.
- **Frontend:** Copy `frontend/.env.example` to `frontend/.env` and insert your client-side keys.

---

## Module 1 Accomplishments

- Scaffolded React + TS + Tailwind CSS v4 template.
- Established FastAPI Python boilerplate with standard module imports.
- Structured environment files `.env.example` and root `.gitignore`.
- Set up Firebase Client config and Google Gemini service wrappers with graceful fallback mocks.
- Built health check API endpoints and verification dashboard showing live frontend-to-backend communication.
