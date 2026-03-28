from pydantic import BaseModel, model_validator


# ============== Send Chat ==========================================
class SendChatRequest(BaseModel):
    drawing_json: dict = dict()
    drawing_url: str = ""  # URL might be base64?
    reference_json: dict = dict()
    reference_url: str = ""
    message: str = ""


class SendChatResponse(BaseModel):
    message: str


# ============== Ingest Reference Image ================================
class IngestReferenceImageRequest(BaseModel):
    reference_image_base64: str  # Data URL or base64


class IngestReferenceImageResponse(BaseModel):
    # strokes: list[str] = list()  # List of base64 data URLs (PNG/JPEG)
    count: int = 0
    message: str = ""


# ============== Get Strokes ================================
class GetStrokeRequest(BaseModel):
    """React frontend sends reference image + optional current drawing state"""

    indexes: list[int] = []  # List of stroke indexes to fetch (e.g. [0] for next stroke, [0,1] for next 2 strokes, etc.)


class GetStrokeResponse(BaseModel):
    stroke_variations: dict[int, str] = dict()  # Dictionary mapping stroke indexes to base64 data URLs (PNG/JPEG)
    message: str = ""


# =====================================================================
