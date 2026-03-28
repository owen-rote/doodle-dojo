from fastapi import APIRouter

from schemas.schemas import IngestReferenceImageRequest, IngestReferenceImageResponse
from schemas.schemas import SendChatRequest, SendChatResponse
import services.gemini_service as gemini_service
import services.stroke_extraction_service as stroke_extraction_service

router = APIRouter(prefix="/api")


@router.get("/", summary="Health check")
async def index():
    return {"message": "Hello, world!"}


@router.post("/upload_reference_image", response_model=IngestReferenceImageResponse)
async def upload_reference_image(body: IngestReferenceImageRequest) -> IngestReferenceImageResponse:
    """Run stroke extraction and return the full stroke JSON to the caller."""
    result = stroke_extraction_service.extract_strokes(body.reference_image_base64)
    return IngestReferenceImageResponse(
        mode=result["mode"],
        image_width=result["image_width"],
        image_height=result["image_height"],
        dot_spacing=result["dot_spacing"],
        stroke_count=result["stroke_count"],
        total_dots=result["total_dots"],
        strokes=result["strokes"],
        message="Success",
    )


@router.post("/send_chat", response_model=SendChatResponse, summary="Send chat message")
async def send_chat(body: SendChatRequest) -> SendChatResponse:
    response = await gemini_service.send_chat(body)
    return response
