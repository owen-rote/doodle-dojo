# Bloom

## How to Run Backend

API root address: `localhost:8000/api/`

http://localhost:8000/docs

```bash
# Install uv if you haven't already
# Mac/Linux:
curl -LsSf https://astral.sh/uv/install.sh | sh

# Make a .env file in backend/ and add:
GEMINI_API_KEY=<your_key>

# Python dependencies with uv
cd buildwithgemini_temp/backend
uv sync

# Run server
uv run uvicorn main:app --reload
```

## How to Run Frontend

```bash
cd frontend/

# Make a .env.local file in frontend/ and add:
GEMINI_API_KEY=<your_key>

# Install dependencies
npm install

# Run
npm run dev
```