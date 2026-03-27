# convert IMG to SWG
from PIL import Image
import io
import base64

def convert_image_to_svg(image_path: str) -> str:
    # Open the image and convert it to RGBA
    image = Image.open(image_path).convert("RGBA")
    
    # Create a new SVG string
    svg_data = f'<svg xmlns="http://www.w3.org/2000/svg" width="{image.width}" height="{image.height}">'
    
    # Iterate through each pixel and create a rectangle for non-transparent pixels
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = image.getpixel((x, y))
            if a > 0:  # Only consider non-transparent pixels
                svg_data += f'<rect x="{x}" y="{y}" width="1" height="1" fill="rgba({r},{g},{b},{a/255})"/>'
    
    svg_data += '</svg>'
    
    return svg_data