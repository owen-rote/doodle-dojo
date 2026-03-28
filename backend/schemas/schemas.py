from pydantic import BaseModel, model_validator


# ── Upload reference image ─────────────────────────────────────────────────────

class IngestReferenceImageRequest(BaseModel):
    reference_image_base64: str  # Data URL or raw base64


class StrokeInfo(BaseModel):
    stroke_id: int
    point_count: int
    stroke_len_px: int
    points: list[list[int]]


class IngestReferenceImageResponse(BaseModel):
    mode: str = ""
    image_width: int = 0
    image_height: int = 0
    dot_spacing: int = 0
    stroke_count: int = 0
    total_dots: int = 0
    strokes: list[StrokeInfo] = []
    message: str = ""


# ── Chat ───────────────────────────────────────────────────────────────────────

class SendChatRequest(BaseModel):
    drawing_json: dict = dict()
    drawing_url: str = ""
    reference_json: dict = dict()
    reference_url: str = ""
    message: str = ""


class SendChatResponse(BaseModel):
    message: str


# ── Generate song ──────────────────────────────────────────────────────────────

class GenerateSongRequest(BaseModel):
    reference_json: dict = dict()
    reference_url: str = ""


class GenerateSongResponse(BaseModel):
    song_data: str = ""
    message: str = ""


# ── Generate reference image ───────────────────────────────────────────────────

class GenerateImageRequest(BaseModel):
    prompt: str | None = None
    image_base64: str | None = None

    @model_validator(mode="after")
    def check_input(self):
        if not self.prompt and not self.image_base64:
            raise ValueError("At least one of prompt or image_base64 must be provided.")
        return self


class GenerateImageResponse(BaseModel):
    generated_image_url: str = ""
    message: str = ""
