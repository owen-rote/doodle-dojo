import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { text } = await request.json();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 503 }
    );
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: "Aoede" },
              },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "TTS API call failed" },
        { status: 502 }
      );
    }

    const data = await response.json();
    const audioData =
      data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioData) {
      return NextResponse.json(
        { error: "No audio data in response" },
        { status: 502 }
      );
    }

    const audioBuffer = Buffer.from(audioData, "base64");

    return new NextResponse(audioBuffer, {
      headers: { "Content-Type": "audio/wav" },
    });
  } catch {
    return NextResponse.json({ error: "TTS request failed" }, { status: 500 });
  }
}
