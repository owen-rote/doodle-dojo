import base64
import os
from pathlib import Path

from PIL import Image
from dotenv import load_dotenv
from google import genai
from google.genai import types

from schemas.schemas import AutocompleteStrokeRequest, AutocompleteStrokeResponse
from schemas.schemas import SendChatRequest, SendChatResponse
from schemas.schemas import GenerateSongRequest, GenerateSongResponse
from schemas.schemas import GenerateImageRequest, GenerateImageResponse
from schemas.schemas import StrokeDrawingInstructionsRequest, StrokeDrawingInstructionsResponse

from services.stroke_instruction_helpers import bullet_lines_from_model_text
from services.stroke_instruction_helpers import format_stroke_points_for_prompt

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=_BACKEND_ROOT / ".env")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY)


async def autocomplete_stroke(request: AutocompleteStrokeRequest) -> AutocompleteStrokeResponse:
    pass


async def send_chat(request: SendChatRequest) -> SendChatResponse:
    response = await client.aio.models.generate_content(model="gemini-2.0-flash", contents=[request.data, request.message])
    return SendChatResponse(message=response.text)


async def generate_song(request: GenerateSongRequest) -> GenerateSongResponse:
    prompt = f"Generate a quiet, instrumental lofi hip-hop track for drawing. Inspired by the visual mood of this image. No lyrics or vocals. Ensure the composition is minimalist and non-distracting for deep focus. Make the track long to last the drawing session."

    response = await client.aio.models.generate_content(
        model="lyria-3-clip-preview",  # TODO: change from preview to pro for production. for now, cheaper but only 30 seconds
        contents=[prompt, Image.open(request.reference_url)],
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO", "TEXT"],
        ),
    )

    audio_data = None
    text_message = ""

    for part in response.parts:
        if part.text is not None:
            text_message = part.text
        elif part.inline_data is not None:
            audio_b64 = base64.b64encode(part.inline_data.data).decode("utf-8")
            audio_data = f"data:audio/mp3;base64,{audio_b64}"

    return GenerateSongResponse(song_data=audio_data or "", message=text_message)


def extract_base64_data(data_url: str) -> str:
    if data_url.startswith("data:"):
        return data_url.split(",", 1)[1]
    return data_url


def mime_type_from_data_url(data_url: str) -> str:
    if not data_url.startswith("data:"):
        return "image/png"
    meta = data_url.split(",", 1)[0]
    rest = meta[5:] if meta.startswith("data:") else meta
    if ";" in rest:
        return rest.split(";", 1)[0] or "image/png"
    return rest or "image/png"


STROKE_INSTRUCTIONS_MODEL = "gemini-3-flash-preview"


async def generate_stroke_drawing_instructions(
    request: StrokeDrawingInstructionsRequest,
) -> StrokeDrawingInstructionsResponse:
    stroke_text = format_stroke_points_for_prompt(request.stroke_points)
    prompt = (
        "You are a drawing instructor. The artist is working from a reference image and has "
        "recorded stroke polylines on a canvas (each stroke is an ordered sequence of (x, y) points).\n\n"
        "Use the reference image to interpret what each stroke should represent (shape, contour, detail).\n\n"
        "Stroke data:\n"
        f"{stroke_text}\n\n"
        "Task: Write concise bullet-point instructions for how to draw these strokes so they match the "
        "reference—cover stroke order if it matters, direction of movement, curvature and corners, "
        "and suggested line weight or pressure where helpful.\n"
        "Output only a bullet list (use '- ' at the start of each line). No title or preamble."
    )

    raw_ref = request.reference_url.strip()
    image_bytes = base64.b64decode(extract_base64_data(raw_ref))
    mime = mime_type_from_data_url(raw_ref)

    response = await client.aio.models.generate_content(
        model=STROKE_INSTRUCTIONS_MODEL,
        contents=[
            prompt,
            types.Part.from_bytes(data=image_bytes, mime_type=mime),
        ],
    )

    raw_text = (response.text or "").strip()
    instructions = bullet_lines_from_model_text(raw_text)
    return StrokeDrawingInstructionsResponse(instructions=instructions, message=raw_text)


async def generate_image(request: GenerateImageRequest) -> GenerateImageResponse:
    contents = []

    # TEXT PART
    if request.prompt:
        prompt = (
            f"Generate a reference image for the following drawing prompt: {request.prompt}. "
            "The image should be simple and clear, capturing the essence of the prompt to inspire a drawing. "
            "Avoid complex details and focus on strong, recognizable shapes and composition."
        )
        contents.append(prompt)

    # IMAGE PART (FIXED)
    if request.image_base64:
        image_bytes = base64.b64decode(extract_base64_data(request.image_base64))

        contents.append(
            types.Part.from_bytes(
                data=image_bytes,
                mime_type="image/png",
            )
        )

    # IMAGE-ONLY FALLBACK PROMPT
    if request.image_base64 and not request.prompt:
        contents.append("Generate a reference image for drawing based on the provided image. " "Keep it simple, abstract, and visually clear.")

    response = await client.aio.models.generate_content(
        model="gemini-3.1-flash-image-preview",
        contents=contents,
        config=types.GenerateContentConfig(
            response_modalities=["TEXT", "IMAGE"],
        ),
    )

    image_data_url = ""
    text_message = ""

    # FIXED RESPONSE PARSING
    for part in response.candidates[0].content.parts:
        if getattr(part, "text", None):
            text_message = part.text
        elif getattr(part, "inline_data", None):
            image_b64 = base64.b64encode(part.inline_data.data).decode("utf-8")
            mime_type = part.inline_data.mime_type or "image/png"
            image_data_url = f"data:{mime_type};base64,{image_b64}"

    return GenerateImageResponse(
        reference_url=image_data_url,
        message=text_message,
    )
