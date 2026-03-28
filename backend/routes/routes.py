from fastapi import APIRouter

from schemas.schemas import IngestReferenceImageRequest, IngestReferenceImageResponse
from schemas.schemas import GetStrokeRequest, GetStrokeResponse
from schemas.schemas import SendChatRequest, SendChatResponse
import services.gemini_service as gemini_service
import services.image_processing_service as image_processing_service

# In memory storage for strokes
_stroke_images_memory: list[str] = []

router = APIRouter(prefix="/api")


@router.get("/", summary="Hello World")
async def index():
    return {"message": "Hello, world!"}


@router.post("/upload_reference_image", response_model=IngestReferenceImageResponse)
async def upload_reference_image(body: IngestReferenceImageRequest) -> IngestReferenceImageResponse:
    """Endpoint to receive reference image uploads from React frontend.

    Pipeline:
    1. Gemini converts the photo into a simple dotted-line sketch.
    2. The sketch is split into per-color layers (black on transparent).
    3. Layers are stored in memory and returned to the caller.
    """
    global _stroke_images_memory
    _stroke_images_memory.clear()
    sketch_img = await gemini_service.ingest_reference_image(body)
    _stroke_images_memory = image_processing_service.split_sketch_by_color(sketch_img)
    return IngestReferenceImageResponse(
        # strokes=_stroke_images_memory,
        count=len(_stroke_images_memory),
        message="Success",
    )


@router.post(
    "/get_strokes",
    response_model=GetStrokeResponse,
    summary="Get strokes",
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
