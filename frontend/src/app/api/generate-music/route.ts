import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";

const API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.NEXT_PUBLIC_GEMINI_API_KEY;

const MODEL = "gemini-2.0-flash";

const SYSTEM_PROMPT = `You are a synesthesia expert who converts images into musical parameters.
Analyze the uploaded image and return a JSON object describing the ideal ambient background music for someone drawing this image.

Return ONLY valid JSON with these fields:
{
  "tempo": <number 40-140, BPM>,
  "key": <string, one of "C", "D", "E", "F", "G", "A", "B">,
  "scale": <string, one of "major", "minor", "pentatonic">,
  "energy": <string, one of "calm", "moderate", "energetic">,
  "mood": <string, short 2-3 word mood like "dreamy warm", "playful bright", "serene cool">,
  "padSound": <string, one of "sine", "triangle", "soft">,
  "brightness": <number 0-1, how bright/sharp the tones should be>
}

Guidelines:
- Nature/landscapes → calm, major/pentatonic, slow tempo
- Animals/cute subjects → playful, moderate energy, pentatonic
- People/portraits → warm, moderate, minor or major depending on expression
- Abstract/geometric → moderate-energetic, any scale
- Dark/moody images → calm-moderate, minor, low brightness
- Colorful/vibrant → moderate-energetic, major, high brightness
- Simple/minimal sketches → calm, pentatonic, low brightness`;

export async function POST(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 500 }
    );
  }

  const body = (await request.json()) as {
    imageBase64?: string;
    imageMimeType?: string;
    textPrompt?: string;
  };

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const parts: { text?: string; inlineData?: { data: string; mimeType: string } }[] = [];

    if (body.imageBase64) {
      parts.push({
        inlineData: {
          data: body.imageBase64,
          mimeType: body.imageMimeType || "image/png",
        },
      });
    }

    parts.push({
      text: body.textPrompt
        ? `${SYSTEM_PROMPT}\n\nThe image was described as: "${body.textPrompt}". Analyze this description and generate music parameters.`
        : SYSTEM_PROMPT,
    });

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts }],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse music parameters from Gemini response");
    }

    const musicParams = JSON.parse(jsonMatch[0]);

    return NextResponse.json(musicParams);
  } catch (error) {
    console.error("Generate music error:", error);
    // Return sensible defaults on failure so music still works
    return NextResponse.json({
      tempo: 72,
      key: "C",
      scale: "pentatonic",
      energy: "calm",
      mood: "gentle focus",
      padSound: "sine",
      brightness: 0.4,
    });
  }
}
