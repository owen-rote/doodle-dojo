# Doodle Dojo - Hackathon Writeup

## One-line pitch
Doodle Dojo turns any photo or text idea into guided sketching lessons, gives live AI coaching while you draw, and then animates your final sketch into a short video.

## The problem
Most people want to draw better, but tutorials are either too generic, too long, or not interactive. Beginners need feedback in the moment, not after they finish.

## Our solution
We built an AI sketching studio that behaves like a friendly drawing coach:

- Input: Upload a reference image or describe what you want to draw.
- Simplify: AI converts the subject into a clean, minimal line sketch style that is easier to trace and learn from.
- Teach: The app generates step-by-step stroke guidance.
- Coach: While the user draws, a live coach gives short, specific feedback (text and optional voice).
- Validate: Stroke matching checks whether the user followed the intended shape.
- Reward: At the end, the sketch can be animated into a short video.

## Demo flow (what judges see)
1. Start on home screen and upload a photo (pet, house, object) or enter a text prompt.
2. Generate a simplified black-and-white or colored sketch reference.
3. Enter session view with reference panel + canvas + coaching panel.
4. Draw stroke by stroke while receiving live feedback.
5. Toggle voice coach for spoken tips.
6. Export the final sketch.
7. Animate the sketch into a short video clip.

## How we built it
### Frontend
- Next.js + React + TypeScript
- Konva/react-konva canvas for drawing and stroke rendering
- Zustand for canvas/session/coach state
- Framer Motion for transitions and UI polish
- App Router API routes for AI orchestration

### Backend
- FastAPI service for reference ingestion and stroke extraction
- OpenCV + scikit-image skeletonization + NetworkX graph traversal
- Converts raster reference image into ordered stroke paths with sampled guide dots
- Returns JSON stroke plan metadata (stroke count, points, lengths, spacing)

### AI system
- Gemini image generation route for style/reference creation from image or text
- Gemini coaching route for short contextual feedback on pass/fail/pause/help
- Gemini TTS route for spoken coaching
- Gemini Live session for low-latency voice/text coaching during drawing
- Veo video generation route to animate the final sketch

## Technical architecture
1. User input (image/text) enters frontend API route.
2. AI generates simplified reference image (bw or colored).
3. Reference image is sent to backend extraction pipeline.
4. Backend returns structured stroke data.
5. Frontend renders guide strokes on canvas.
6. User draws; stroke validator compares user path against guide path.
7. Coaching events call AI endpoints (and optional TTS/live voice).
8. Final sketch snapshot is sent to animation endpoint for video output.

## Key technical decisions
- Simplification-first pipeline: We intentionally reduce visual complexity so users can actually complete drawings in a short session.
- Stroke graph extraction: Skeleton + graph walking gives ordered, discrete stroke sequences instead of raw pixels.
- Hybrid coaching: Local fallback messaging exists when model calls fail, so the UX degrades gracefully.
- End-to-end creative loop: Input -> guided learning -> creation -> animated payoff.

## Challenges we faced
- Converting arbitrary reference images into usable, ordered stroke plans.
- Balancing strict stroke validation with beginner-friendly tolerance.
- Keeping live feedback short and actionable instead of verbose.
- Managing latency and reliability across multiple model endpoints.
- Preserving the original sketch style when animating with video generation.

## What we are proud of
- A full creative pipeline that feels like one product, not disconnected demos.
- Real-time coaching integrated directly into the drawing loop.
- A practical computer vision backend that transforms images into teachable stroke data.
- A compelling final moment: turning user drawings into animated video.

## What we learned
- The best AI UX is not just generation quality, it is interaction timing.
- Short, contextual feedback is more useful than long critique.
- Good fallback behavior is essential in hackathon demos.
- Visual simplification dramatically improves novice success rates.

## Impact and use cases
- Beginner art education and daily sketch practice.
- Parent/child creative activities.
- Classroom art exercises with guided progression.
- Accessibility-friendly drawing coach with optional voice feedback.

## Future roadmap
- Personalized difficulty and pacing based on user performance history.
- Better stroke ordering and semantic labeling for complex subjects.
- Layer-aware coloring and depth effects for richer final outputs.
- Shareable timelapses, community challenges, and remixable prompts.
- Multi-language coaching and broader voice options.

## Tech stack summary
- Frontend: Next.js, React, TypeScript, Konva, Zustand, Framer Motion
- Backend: FastAPI, OpenCV, scikit-image, NetworkX, NumPy
- AI: Gemini (image, text, live, TTS) + Veo animation
- Runtime/tooling: Node.js + Python (uv-managed dependencies)

## Quick run instructions
### Backend
1. Create backend .env with GEMINI_API_KEY.
2. Install deps with uv.
3. Run FastAPI app.

### Frontend
1. Create frontend .env.local with GEMINI_API_KEY and backend URL.
2. Install deps with npm.
3. Run Next.js dev server.

## Team close
We built Doodle Dojo to make drawing practice interactive, supportive, and genuinely fun. Instead of staring at static tutorials, users can learn by doing, get coached in real time, and finish with something they are excited to share.
