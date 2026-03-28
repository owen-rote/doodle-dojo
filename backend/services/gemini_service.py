import base64
import io
import os
from pathlib import Path

from PIL import Image
from dotenv import load_dotenv
from google import genai
from google.genai import types

from schemas.schemas import IngestReferenceImageRequest, IngestReferenceImageResponse
from schemas.schemas import SendChatRequest, SendChatResponse
from schemas.schemas import GenerateSongRequest, GenerateSongResponse
from schemas.schemas import GenerateImageRequest, GenerateImageResponse

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY)


async def ingest_reference_image(request: IngestReferenceImageRequest) -> Image.Image:
    """
    Passes the reference image through Gemini to produce a simple dotted-line sketch.
    Returns the generated sketch as a PIL Image.
    """
    image_bytes = base64.b64decode(extract_base64_data(request.reference_image_base64))
    input_image = Image.open(io.BytesIO(image_bytes))
    prompt = (
        "Use this picture to create a beginner dotted stroke guide. "
        "Each stroke must be a different color. "
        "Use bold, saturated colors for the dots, never pale, pastel, faded, translucent, or low-contrast colors. "
        "Draw strokes using dots only. "
        "Do not connect dots with lines. "
        "Do not draw outlines, curves, sketch lines, shadows, glow, texture, or gradients. "
        "Each stroke should appear only as separated, clearly visible, filled circular dots. "
        "Keep only the main subject and remove the background entirely. "
        "Keep the background plain white and empty. "
        "Do not include the background in the stroke colors or the dot plan. "
        "Do NOT add any numbers, labels, arrows, or text."
    )

    response = await client.aio.models.generate_content(
        model="gemini-3.1-flash-image-preview",
        contents=[prompt, input_image],
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            thinking_config=types.ThinkingConfig(
                thinking_level="MINIMAL",
            ),
        ),
    )

    parts = []
    for part in getattr(response, "parts", []) or []:
        if getattr(part, "inline_data", None):
            parts.append(part)
    if not parts and getattr(response, "candidates", None):
        for part in response.candidates[0].content.parts:
            if getattr(part, "inline_data", None):
                parts.append(part)

    if not parts:
        raise ValueError("Gemini did not return an image for the reference sketch.")

    image_bytes = parts[0].inline_data.data
    generated_path = Path(__file__).resolve().parent.parent / "GENERATED.png"
    generated_path.write_bytes(image_bytes)
    return Image.open(io.BytesIO(image_bytes)).convert("RGBA")



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
            thinking_config=types.ThinkingConfig(
                thinking_level="High",
                include_thoughts=False,
            ),
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


def detect_image_mime_type(image_bytes: bytes) -> str:
    """Detect MIME type from image magic bytes."""
    if image_bytes.startswith(b"\x89PNG"):
        return "image/png"
    elif image_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    return "image/png"  # Default fallback
