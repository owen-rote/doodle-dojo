import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { event, strokeLabel, instruction, tips, common_mistakes, failCount } =
    await request.json();

  // When GEMINI_API_KEY is set, call Gemini Flash for real coaching.
  // For now, return contextual fallback messages.

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const systemPrompt =
        "You are a friendly, encouraging drawing coach. Keep responses brief (1-2 sentences max). Be specific about shapes and strokes. Use simple, clear language.";

      let prompt = "";
      switch (event) {
        case "stroke_pass":
          prompt = `The user successfully completed the "${strokeLabel}" stroke. Give brief encouragement and preview the next stroke.`;
          break;
        case "stroke_fail":
          prompt =
            failCount >= 3
              ? `The user has failed the "${strokeLabel}" stroke ${failCount} times. Instruction: "${instruction}". Give specific guidance.`
              : `The user's stroke didn't match "${strokeLabel}". Give a brief encouraging tip.`;
          break;
        case "pause":
          prompt = `The user paused while drawing "${strokeLabel}". Instruction: "${instruction}". Give a gentle tip.`;
          break;
        case "help_request":
          prompt = `The user asked for help with "${strokeLabel}". Instruction: "${instruction}". Tips: "${tips}". Common mistakes: "${common_mistakes}". Give detailed guidance.`;
          break;
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: `${systemPrompt}\n\n${prompt}` }] },
            ],
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text =
          data.candidates?.[0]?.content?.parts?.[0]?.text ??
          "Keep going, you're doing great!";
        return NextResponse.json({ text });
      }
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback responses
  const fallbacks: Record<string, string> = {
    stroke_pass: `Great job on the ${strokeLabel ?? "stroke"}! Ready for the next one.`,
    stroke_fail:
      failCount >= 3
        ? `Take a closer look at the guide — ${tips ?? "try to match the curve more closely"}.`
        : `Almost! ${tips ?? "Try following the dashed line more closely."}`,
    pause: `Tip: ${tips ?? "Follow the dashed guide stroke carefully."}`,
    help_request: instruction ?? "Follow the dashed guide stroke on the canvas.",
  };

  return NextResponse.json({ text: fallbacks[event] ?? "Keep drawing!" });
}
