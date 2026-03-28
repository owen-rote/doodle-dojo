export type ParsedLivePayload =
  | { kind: "setup_complete" }
  | { kind: "audio_b64"; data: string; mimeType?: string }
  | { kind: "text"; text: string }
  | { kind: "output_transcription"; text: string; finished: boolean }
  | { kind: "input_transcription"; text: string; finished: boolean }
  | { kind: "interrupted" }
  | { kind: "turn_complete" }
  | { kind: "error"; message: string };

function pick(
  obj: Record<string, unknown>,
  camel: string,
  snake: string
): unknown {
  const v = obj[camel];
  return v !== undefined && v !== null ? v : obj[snake];
}

function transcriptionText(block: Record<string, unknown>): string | undefined {
  const t = block.text ?? block.transcript ?? block.content;
  return typeof t === "string" ? t : undefined;
}

function pushTranscriptionPayloads(
  out: ParsedLivePayload[],
  block: Record<string, unknown> | undefined,
  kind: "output_transcription" | "input_transcription"
) {
  if (!block) return;
  const text = transcriptionText(block);
  if (!text) return;
  out.push({
    kind,
    text,
    finished: Boolean(block.finished),
  });
}

/** Some Live responses nest `outputTranscription` where the shallow parser misses it. */
function deepCollectOutputTranscriptions(
  node: unknown,
  out: ParsedLivePayload[],
  seen: Set<string>
): void {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const x of node) deepCollectOutputTranscriptions(x, out, seen);
    return;
  }
  const o = node as Record<string, unknown>;
  for (const [k, v] of Object.entries(o)) {
    if (
      (k === "outputTranscription" || k === "output_transcription") &&
      v &&
      typeof v === "object" &&
      !Array.isArray(v)
    ) {
      const block = v as Record<string, unknown>;
      const text = transcriptionText(block);
      if (text && text.length > 0) {
        const key = `${text}\0${Boolean(block.finished)}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({
            kind: "output_transcription",
            text,
            finished: Boolean(block.finished),
          });
        }
      }
    }
    deepCollectOutputTranscriptions(v, out, seen);
  }
}

export function parseGeminiLiveServerMessage(raw: unknown): ParsedLivePayload[] {
  if (typeof raw !== "object" || raw === null) return [];

  const data = raw as Record<string, unknown>;
  const out: ParsedLivePayload[] = [];

  if (pick(data, "setupComplete", "setup_complete") != null) {
    out.push({ kind: "setup_complete" });
  }

  const errRaw = data.error;
  if (errRaw && typeof errRaw === "object") {
    const err = errRaw as Record<string, unknown>;
    const msg =
      typeof err.message === "string"
        ? err.message
        : JSON.stringify(errRaw);
    out.push({ kind: "error", message: msg });
  }

  // API may send these at the message root, not under serverContent.
  pushTranscriptionPayloads(
    out,
    pick(data, "outputTranscription", "output_transcription") as
      | Record<string, unknown>
      | undefined,
    "output_transcription"
  );
  pushTranscriptionPayloads(
    out,
    pick(data, "inputTranscription", "input_transcription") as
      | Record<string, unknown>
      | undefined,
    "input_transcription"
  );

  const serverContent = pick(data, "serverContent", "server_content") as
    | Record<string, unknown>
    | undefined;
  if (!serverContent) return out;

  const modelTurn = pick(serverContent, "modelTurn", "model_turn") as
    | Record<string, unknown>
    | undefined;
  const parts = modelTurn?.parts as unknown[] | undefined;
  if (Array.isArray(parts)) {
    for (const part of parts) {
      if (typeof part !== "object" || part === null) continue;
      const p = part as Record<string, unknown>;
      // Gemini 3 "thought" parts are internal reasoning — do not show as coach text.
      if (p.thought === true) continue;

      const inline = pick(p, "inlineData", "inline_data") as
        | Record<string, unknown>
        | undefined;
      if (inline && typeof inline.data === "string") {
        const mime =
          (pick(inline, "mimeType", "mime_type") as string | undefined) ||
          undefined;
        const isAudio =
          !mime ||
          /audio|pcm|L16/i.test(mime) ||
          !/^image\//i.test(mime);
        if (isAudio) {
          out.push({ kind: "audio_b64", data: inline.data, mimeType: mime });
        }
      }
      if (typeof p.text === "string" && p.text.length > 0) {
        out.push({ kind: "text", text: p.text });
      }
    }
  }

  pushTranscriptionPayloads(
    out,
    pick(serverContent, "outputTranscription", "output_transcription") as
      | Record<string, unknown>
      | undefined,
    "output_transcription"
  );
  pushTranscriptionPayloads(
    out,
    pick(serverContent, "inputTranscription", "input_transcription") as
      | Record<string, unknown>
      | undefined,
    "input_transcription"
  );

  if (serverContent.interrupted) {
    out.push({ kind: "interrupted" });
  }

  if (pick(serverContent, "turnComplete", "turn_complete")) {
    out.push({ kind: "turn_complete" });
  }

  const hadOutputTx = out.some((p) => p.kind === "output_transcription");
  if (!hadOutputTx) {
    deepCollectOutputTranscriptions(data, out, new Set());
  }

  return out;
}
