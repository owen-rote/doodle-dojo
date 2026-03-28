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
    prompt = "use this picture, convert it into dotted strokes for beginners, each new stroke is a different color. Do NOT add any numbers"

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

    # TODO, for now save the image as GENERATED.png
    with open("GENERATED.png", "wb") as f:
        for part in response.candidates[0].content.parts:
            if getattr(part, "inline_data", None):
                f.write(part.inline_data.data)

    parts = []
    output_images: list[str] = []

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

    sketch_img = Image.open(io.BytesIO(parts[0].inline_data.data))
    return sketch_img


async def send_chat(request: SendChatRequest) -> SendChatResponse:
    response = await client.aio.models.generate_content(model="gemini-2.0-flash", contents=[request.data, request.message])
    return SendChatResponse(message=response.text)


def extract_base64_data(data_url: str) -> str:
    if data_url.startswith("data:"):
        return data_url.split(",", 1)[1]
    return data_url


def detect_image_mime_type(image_bytes: bytes) -> str:
    """Detect MIME type from image magic bytes."""
    if image_bytes.startswith(b"\x89PNG"):
        return "image/png"
    elif image_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    return "image/png"  # Default fallback
