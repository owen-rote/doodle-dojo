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
    #strokes: list[str] = list()  # List of base64 data URLs (PNG/JPEG)
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


# ============== Generate Song ========================================
# TODO: figure out filetypes and encoding for audio data transfer
class GenerateSongRequest(BaseModel):
    reference_json: dict = dict()
    reference_url: str = ""


class GenerateSongResponse(BaseModel):
    song_data: str = ""
    message: str = ""


# =====================================================================


# ============== Generate Reference Image ========================================
class GenerateImageRequest(BaseModel):
    """input can be either text prompt or reference image, or both"""

    prompt: str | None = None
    image_base64: str | None = None

    @model_validator(mode="after")
    def check_input(self):
        if not self.prompt and not self.image_base64:
            raise ValueError("At least one of prompt or image_base64 must be provided.")
        return self


class GenerateImageResponse(BaseModel):
    generated_image_url: str = ""  # generated images are better returned as links
    message: str = ""


# =====================================================================


# ============== Guided Drawing - Stroke Session =======================
class StrokeMetadata(BaseModel):
    """Optional metadata about a stroke"""

    bbox: dict | None = None  # {"x": 0, "y": 0, "width": 100, "height": 100}
    vector_path: str | None = None  # SVG path data if vectorized


class StartSessionRequest(BaseModel):
    """Begin a guided drawing session with a reference image"""

    user_id: str
    reference_image_base64: str  # Reference image as data URL or base64


class StartSessionResponse(BaseModel):
    """Initial session data with first stroke overlay"""

    session_id: str
    first_stroke_overlay: str  # Base64 data URL of first stroke (transparent PNG)
    total_strokes: int  # How many strokes user will draw
    current_stroke_index: int = 0


class NextStrokeRequest(BaseModel):
    """Fetch next stroke overlay"""

    session_id: str
    user_id: str


class NextStrokeResponse(BaseModel):
    """Next stroke overlay"""

    stroke_overlay: str  # Base64 data URL
    current_stroke_index: int
    total_strokes: int
    is_complete: bool  # True if this was the last stroke


# =====================================================================

# ============== Generate Video ========================================
