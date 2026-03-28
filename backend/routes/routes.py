from fastapi import APIRouter

from schemas.schemas import IngestReferenceImageRequest, IngestReferenceImageResponse
from schemas.schemas import GetStrokeRequest, GetStrokeResponse
from schemas.schemas import SendChatRequest, SendChatResponse
from schemas.schemas import GenerateSongRequest, GenerateSongResponse
from schemas.schemas import GenerateImageRequest, GenerateImageResponse
import services.gemini_service as gemini_service

# In memory storage for strokes
_stroke_images_memory: list[str] = []

router = APIRouter(prefix="/api")


@router.get("/", summary="Hello World")
async def index():
    return {"message": "Hello, world!"}


@router.post("/upload_reference_image")
async def upload_reference_image(body: IngestReferenceImageRequest):
    """Endpoint to receive reference image uploads from React frontend."""
    global _stroke_images_memory
    _stroke_images_memory = await gemini_service.ingest_reference_image(body)
    return IngestReferenceImageResponse(count=len(_stroke_images_memory), message="Success")


@router.post(
    "/get_strokes",
    response_model=GetStrokeResponse,
    summary="Get stroke variations",
)
async def get_strokes(body: GetStrokeRequest) -> GetStrokeResponse:
    """Get stored strokes from backend based on provided stroke indexes."""
    if not _stroke_images_memory:
        return GetStrokeResponse(stroke_variations={}, message="No stroke images ingested yet.")

    requested_indexes = getattr(body, "indexes", [])
    stroke_variations = {index: _stroke_images_memory[index] for index in requested_indexes if 0 <= index < len(_stroke_images_memory)}

    missing_indexes = [index for index in requested_indexes if index < 0 or index >= len(_stroke_images_memory)]
    message = "Fetched requested stroke images from memory."
    if missing_indexes:
        message += f" Skipped out-of-range indexes: {missing_indexes}."

    return GetStrokeResponse(stroke_variations=stroke_variations, message=message)


@router.post(
    "/send_chat",
    response_model=SendChatResponse,
    summary="Send chat message",
)
async def send_chat(body: SendChatRequest) -> SendChatResponse:
    """Sending chat message in chat window, along with current drawing AND reference image as context."""
    response = await gemini_service.send_chat(body)
    return response


@router.post(
    "/generate_song",
    response_model=GenerateSongResponse,
    summary="Generate song based on reference image",
)
async def generate_song(body: GenerateSongRequest) -> GenerateSongResponse:
    """Generate a lofi background music track based on reference image to listen to while drawing."""
    response = await gemini_service.generate_song(body)
    return response


@router.post(
    "/generate_image",
    response_model=GenerateImageResponse,
    summary="Generate reference image for drawing prompt",
)
async def generate_image(body: GenerateImageRequest) -> GenerateImageResponse:
    """Generate a reference image for the given drawing prompt."""
    response = await gemini_service.generate_image(body)
    return response
