### Draw with Doodle Dojo 

Doodle Dojo turns any photo or text idea into guided sketching lessons, gives live AI coaching while you draw, and then animates your final sketch into a short video.

Most people want to draw better, but tutorials are either too generic, too long, or not interactive. Beginners need feedback in the moment, not after they finish.

This repo contains:

- a `Next.js` frontend for the drawing experience
- a `FastAPI` backend for reference processing and stroke-guide generation
- Gemini integrations for sketch generation and live coaching
- Veo integration for sketch-to-video animation
- Lyria integration for prompted background music while drawing

## Demo

Paste your demo links here.

### Main Demo

`Add link`

### Animation Demo

`Add link`

### Live Coach Demo

`Add link`

### Lyria Demo

`Add link`

## What It Does

- Converts a text prompt or uploaded image into a clean simplified sketch.
- Breaks the sketch into stroke-by-stroke guidance.
- Shows the current guide overlay on the canvas while the user draws.
- Gives live Gemini coach feedback during the drawing session.
- Lets the user export the sketch as a PNG.
- Lets the user animate the finished sketch into a short Veo video and save the MP4.
- Lets the user enter lyrics or a music vibe prompt for Lyria music generation while drawing when coach voice is off.

## Project Structure

```text
doodledojo/
├── backend/    # FastAPI app for reference upload + stroke processing
└── frontend/   # Next.js app for the drawing experience
```

## Tech Stack

- Frontend: `Next.js 16`, `React 19`, `TypeScript`, `Tailwind CSS 4`, `Framer Motion`, `Konva`, `Zustand`
- Backend: `FastAPI`, `Python 3.12`, `uv`, `google-genai`
- Gemini: `Nano Banana 2`, `Lyria 3 Pro preview`, `Gemini 3.1`, `Veo 3.1`

## How It Works

1. The user starts from the frontend and either uploads an image or types a prompt.
2. The frontend asks Gemini to generate a simplified sketch.
3. That sketch is sent to the backend for stroke-guide processing.
4. The session view loads and displays the current guide overlay on the canvas.
5. As the user finishes strokes, the app advances through the guide sequence and updates progress.
6. Gemini Live can provide feedback while the user draws.
7. If coach voice is off, the user can prompt Lyria with lyrics or vibe guidance and let music play while they draw.
8. After the final stroke, the user can animate the sketch with Veo and save the result.

## Local Development

### 1. Clone and install

```bash
git clone <your-repo-url>
cd doodledojo
```

### 2. Run the backend

```bash
cd backend
uv sync
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend docs will be available at:

```text
http://localhost:8000/docs
```

### 3. Run the frontend

```bash
cd frontend
npm install
npm run dev
```
<<<<<<< HEAD

Frontend will be available at:

```text
http://localhost:3000
```

## Environment Variables

### Backend

Create `backend/.env`:

```bash
GEMINI_API_KEY=your_api_key_here
```

### Frontend

Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

Optional frontend vars:

```bash
GEMINI_VEO_MODEL=veo-3.1-generate-preview
NEXT_PUBLIC_GEMINI_LIVE_MODEL=gemini-2.5-flash-native-audio-latest
NEXT_PUBLIC_LYRIA_MODEL=lyria-realtime-exp
NEXT_PUBLIC_GEMINI_LIVE_DEBUG=0
```

## Key Endpoints

Frontend API routes:

- `/api/generate-style`
- `/api/upload-reference`
- `/api/get-strokes`
- `/api/coaching`
- `/api/tts`
- `/api/animate-sketch`

Backend entrypoint:

- `backend/main.py`

## Current Highlights

- Finished-sketch Veo animation flow is built into the session UI.
- Live guide overlays advance stroke by stroke.
- PNG export is supported from the drawing session.
- Lyria soundtrack support can be steered with lyric or vibe prompts while drawing.




