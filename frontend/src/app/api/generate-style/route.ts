import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// ─── Prompt templates ───
const PROMPTS = {
  bw_image: `Look at this reference photo and GENERATE a new image from it: an EXTREMELY SIMPLIFIED black and white line sketch of the same subject. You MUST output the drawing as an image.

SIMPLIFICATION RULES — THIS IS CRITICAL:
- Reduce the subject to its ABSOLUTE ESSENCE
- Maximum 15-30 strokes to draw the ENTIRE image
- Think like a LOGO DESIGNER or ICON ARTIST
- Remove ALL unnecessary details
- Keep only the most recognizable contours and shapes
- If a detail isn't essential to recognize the subject, REMOVE IT
- Merge small details into larger simple shapes
- No texture, no patterns, no fine details

WHAT TO KEEP:
- Main silhouette/outline
- 2-3 key defining features that make the subject recognizable
- Basic structural shapes

WHAT TO REMOVE:
- Windows, bricks, tiles, textures
- Small decorative elements
- Repeated patterns
- Fine details, wrinkles, fur texture
- Background elements
- Shadows and shading

OUTPUT SPECIFICATIONS:
- Pure BLACK lines on WHITE background
- NO fills, NO shading, NO gradients
- NO gray tones — only black and white
- Line weight: Medium-thick, consistent
- Clean, smooth curves — no sketchy/rough lines
- All shapes should be CLOSED (lines connect)
- Subject centered, NO background

THINK:
- A 5-year-old could trace this
- A logo or app icon version of the subject
- Pictogram/symbol level of simplicity

Generate and output the image now. The output should look like a simple icon or logo, NOT a detailed illustration.`,

  bw_text: `GENERATE an image: an EXTREMELY SIMPLIFIED black and white line sketch of the subject described below. You MUST output the drawing as an image.

SIMPLIFICATION RULES — THIS IS CRITICAL:
- Reduce the subject to its ABSOLUTE ESSENCE
- Maximum 15-30 strokes to draw the ENTIRE image
- Think like a LOGO DESIGNER or ICON ARTIST
- Remove ALL unnecessary details
- Keep only the most recognizable contours and shapes
- If a detail isn't essential to recognize the subject, REMOVE IT
- Merge small details into larger simple shapes
- No texture, no patterns, no fine details

WHAT TO KEEP:
- Main silhouette/outline
- 2-3 key defining features that make the subject recognizable
- Basic structural shapes

WHAT TO REMOVE:
- Unnecessary background elements
- Small decorative details
- Repeated patterns
- Fine details, wrinkles, fur texture
- Shadows and shading

OUTPUT SPECIFICATIONS:
- Pure BLACK lines on WHITE background
- NO fills, NO shading, NO gradients
- NO gray tones — only black and white
- Line weight: Medium-thick, consistent
- Clean, smooth curves — no sketchy/rough lines
- All shapes should be CLOSED (lines connect)
- Subject centered, NO background

THINK:
- A 5-year-old could trace this
- A logo or app icon version of the subject
- Pictogram/symbol level of simplicity

Generate and output the image now. The output should look like a simple icon or logo, NOT a detailed illustration.`,

  colored_image: `Look at this reference photo and GENERATE a new image from it: an EXTREMELY SIMPLIFIED colored sketch of the same subject. You MUST output the drawing as an image.

SIMPLIFICATION RULES — THIS IS CRITICAL:
- This should be the EXACT SAME level of simplicity as a logo or icon
- Maximum 15-30 strokes/shapes to draw the ENTIRE image
- Think like a LOGO DESIGNER or ICON ARTIST
- Remove ALL unnecessary details
- Keep only the most recognizable contours and shapes
- Merge small details into larger simple shapes
- No texture, no patterns, no fine details

WHAT TO KEEP:
- Main silhouette/outline
- 2-3 key defining features
- Basic structural shapes

WHAT TO REMOVE:
- Windows, bricks, tiles, textures
- Small decorative elements
- Repeated patterns
- Fine details
- Background elements

COLOR SPECIFICATIONS:
- Use FLAT, SOLID colors inspired by the original image
- Maximum 5-8 colors total
- NO gradients, NO shading, NO highlights
- Colors should be slightly simplified/consolidated
- BLACK outlines around all shapes
- WHITE background

OUTPUT SPECIFICATIONS:
- BLACK outlines with FLAT COLOR fills
- Cel-shaded / cartoon coloring style
- No texture or shading within colored areas
- Clean, smooth curves
- Subject centered, NO background

THINK:
- A colored logo or app icon
- A cartoon/emoji version of the subject
- Flat design illustration style

Generate and output the image now. The output should look like a simple colored icon, NOT a detailed illustration.`,

  colored_text: `GENERATE an image: an EXTREMELY SIMPLIFIED colored sketch of the subject described below. You MUST output the drawing as an image.

SIMPLIFICATION RULES — THIS IS CRITICAL:
- This should be the EXACT SAME level of simplicity as a logo or icon
- Maximum 15-30 strokes/shapes to draw the ENTIRE image
- Think like a LOGO DESIGNER or ICON ARTIST
- Remove ALL unnecessary details
- Keep only the most recognizable contours and shapes
- Merge small details into larger simple shapes
- No texture, no patterns, no fine details

WHAT TO KEEP:
- Main silhouette/outline
- 2-3 key defining features
- Basic structural shapes

WHAT TO REMOVE:
- Unnecessary background elements
- Small decorative details
- Repeated patterns
- Fine details
- Shadows and shading

COLOR SPECIFICATIONS:
- Pick FLAT, SOLID colors that naturally fit the subject
- Maximum 5-8 colors total
- NO gradients, NO shading, NO highlights
- Colors should be bold and simplified
- BLACK outlines around all shapes
- WHITE background

OUTPUT SPECIFICATIONS:
- BLACK outlines with FLAT COLOR fills
- Cel-shaded / cartoon coloring style
- No texture or shading within colored areas
- Clean, smooth curves
- Subject centered, NO background

THINK:
- A colored logo or app icon
- A cartoon/emoji version of the subject
- Flat design illustration style

Generate and output the image now. The output should look like a simple colored icon, NOT a detailed illustration.`,
};

const GEMINI_MODEL = "gemini-3.1-flash-image-preview"; // Nano Banana 2

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const { style, inputType, textPrompt, imageBase64, imageMimeType } = body as {
    style: "bw" | "colored";
    inputType: "image" | "text";
    textPrompt?: string;
    imageBase64?: string;
    imageMimeType?: string;
  };

  // Validate
  if (!style || !inputType) {
    return NextResponse.json(
      { error: "Missing style or inputType" },
      { status: 400 }
    );
  }

  if (inputType === "text" && !textPrompt?.trim()) {
    return NextResponse.json(
      { error: "Missing textPrompt" },
      { status: 400 }
    );
  }

  if (inputType === "image" && !imageBase64) {
    return NextResponse.json(
      { error: "Missing imageBase64" },
      { status: 400 }
    );
  }

  // Select prompt
  const promptKey = `${style}_${inputType}` as keyof typeof PROMPTS;
  const prompt = PROMPTS[promptKey];

  // Build contents for the SDK
  // For image input: [image, text prompt]
  // For text input: [combined prompt + user description]
  const contents: Array<string | { inlineData: { mimeType: string; data: string } }> = [];

  if (inputType === "image" && imageBase64) {
    contents.push({
      inlineData: {
        mimeType: imageMimeType || "image/png",
        data: imageBase64,
      },
    });
    contents.push(prompt || "");
  }

  if (inputType === "text" && textPrompt) {
    const fullText = prompt
      ? `${prompt}\n\nSubject to draw: ${textPrompt}`
      : textPrompt;
    contents.push(fullText);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
    });

    // Extract the generated image from the response
    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) {
      return NextResponse.json(
        { error: "No content in Gemini response" },
        { status: 502 }
      );
    }

    let generatedImageBase64: string | null = null;
    let generatedMimeType: string | null = null;
    let responseText: string | null = null;

    for (const part of parts) {
      if (part.inlineData) {
        generatedImageBase64 = part.inlineData.data ?? null;
        generatedMimeType = part.inlineData.mimeType ?? null;
      }
      if (part.text) {
        responseText = part.text;
      }
    }

    if (!generatedImageBase64) {
      return NextResponse.json(
        { error: "No image generated by Gemini", responseText },
        { status: 502 }
      );
    }

    return NextResponse.json({
      image: generatedImageBase64,
      mimeType: generatedMimeType,
      text: responseText,
    });
  } catch (err) {
    console.error("Generate style error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
