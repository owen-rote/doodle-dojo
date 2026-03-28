from fastapi import APIRouter

from schemas.schemas import IngestReferenceImage, IngestReferenceImageResponse
from schemas.schemas import AutocompleteStrokeRequest, AutocompleteStrokeResponse
from schemas.schemas import SendChatRequest, SendChatResponse
from schemas.schemas import GenerateSongRequest, GenerateSongResponse
from schemas.schemas import GenerateImageRequest, GenerateImageResponse
import services.gemini_service as gemini_service

router = APIRouter(prefix="/api")


@router.get("/", summary="Hello World")
async def index():
    return {"message": "Hello, world!"}


@router.post("/upload_reference_image")
async def upload_reference_image(body: IngestReferenceImage):
    """Endpoint to receive reference image uploads from React frontend."""
    stroke_images = await gemini_service.ingest_reference_image(body)
    return IngestReferenceImageResponse(strokes=stroke_images, message="Reference image ingested successfully.")


@router.post("/autocomplete_stroke", response_model=AutocompleteStrokeResponse, summary="Autocomplete next stroke")
async def autocomplete_stroke(body: AutocompleteStrokeRequest) -> AutocompleteStrokeResponse:
    """Autocomplete with dotted line to suggest next stroke."""
    return AutocompleteStrokeResponse(stroke_variations=[], message="Autocomplete stroke endpoint")


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
