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


# =====================================================================


# ============== Autocomplete Stroke ================================
class AutocompleteStrokeRequest(BaseModel):
    drawing_json: dict = dict()
    drawing_url: str = ""
    reference_json: dict = dict()
    reference_url: str = ""


class AutocompleteStrokeResponse(BaseModel):
    completions: list[str] = list()
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
    generated_image_url: str = "" # # generated images are better returned as links 
    message: str = ""  


# =====================================================================

# ============== Generate Video ========================================