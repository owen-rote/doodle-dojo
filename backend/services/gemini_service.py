import base64
import io
import os
from pathlib import Path

import cv2
import numpy as np
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
_GENERATED_IMAGE_PATH = Path(__file__).resolve().parent.parent / "GENERATED.png"


def _save_debug_image(image: Image.Image, path: Path = _GENERATED_IMAGE_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG")


def _looks_like_tracing_sketch(image: Image.Image) -> bool:
    rgb_pixels = np.asarray(image.convert("RGB"), dtype=np.uint8)
    bgr_pixels = cv2.cvtColor(rgb_pixels, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(bgr_pixels, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(bgr_pixels, cv2.COLOR_BGR2HSV)

    white_ratio = float(np.count_nonzero(gray >= 240) / gray.size)
    dark_ratio = float(np.count_nonzero(gray <= 80) / gray.size)
    saturation_mean = float(hsv[:, :, 1].mean())

    return white_ratio >= 0.45 and dark_ratio <= 0.35 and saturation_mean <= 45.0


async def ingest_reference_image(request: IngestReferenceImageRequest) -> Image.Image:
    """
    Normalizes the uploaded image into a clean tracing sketch for stroke extraction.
    If the input is already sketch-like, Gemini is skipped.
    """
    image_bytes = base64.b64decode(extract_base64_data(request.reference_image_base64))
    input_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    if _looks_like_tracing_sketch(input_image):
        _save_debug_image(input_image)
        return input_image

    prompt = (
        "Convert this image into a very simple beginner tracing sketch. "
        "Use clean, solid, continuous black outlines on a plain white background. "
        "Keep only the main silhouette and a few defining shapes. "
        "No fills, no shading, no gradients, no dots, no hatching, no texture, no background, no numbers, and no text. "
        "Make the result easy to break into 15 to 30 traceable strokes."
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

    # Preferred response shape from Gemini docs.
    for part in getattr(response, "parts", []) or []:
        if getattr(part, "inline_data", None):
            parts.append(part)
    if not parts and getattr(response, "candidates", None):
        for part in response.candidates[0].content.parts:
            if getattr(part, "inline_data", None):
                parts.append(part)

    if not parts:
        raise ValueError("Gemini did not return an image for the reference sketch.")

    sketch_img = Image.open(io.BytesIO(parts[0].inline_data.data)).convert("RGB")
    _save_debug_image(sketch_img)
    return sketch_img


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
        generated_image_url=image_data_url,
        message=text_message,
    )


def detect_image_mime_type(image_bytes: bytes) -> str:
    """Detect MIME type from image magic bytes."""
    if image_bytes.startswith(b"\x89PNG"):
        return "image/png"
    elif image_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    return "image/png"  # Default fallback
