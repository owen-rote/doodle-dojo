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
class IngestReferenceImage(BaseModel):
    reference_image_base64: str  # Data URL or base64


# ============== Autocomplete Stroke ================================
class AutocompleteStrokeRequest(BaseModel):
    """React frontend sends reference image + optional current drawing state"""

    reference_image_base64: str  # Data URL or base64: reference/inspiration image
    current_drawing_base64: str | None = None  # Optional: current canvas state (PNG/JPEG as base64 data URL)

    @model_validator(mode="after")
    def check_input(self):
        if not self.reference_image_base64:
            raise ValueError("reference_image_base64 is required.")
        return self


class AutocompleteStrokeResponse(BaseModel):
    stroke_variations: list[str] = list()  # List of base64 data URLs (PNG/JPEG)
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
    generated_image_url: str = ""  # # generated images are better returned as links
    message: str = ""


# =====================================================================

# ============== Generate Video ========================================
