/**
 * Drop obvious internal monologue / meta narration that sometimes leaks into
 * TEXT or transcription when the model "thinks out loud".
 */
export function coachTextForUi(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;

  const internal =
    /\*Initiating\b/i.test(t) ||
    /\bInitiating Visual\b/i.test(t) ||
    /\bMy immediate thought is\b/i.test(t) ||
    /\bHaving identified the lack of\b/i.test(t) ||
    (/blank canvas/i.test(t) &&
      /\b(starting|identified|thought|prompt the user)\b/i.test(t));

  if (internal) return null;
  return t;
}
