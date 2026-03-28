/**
 * Plays raw little-endian 16-bit PCM at 24kHz (Gemini Live native audio output).
 */

const OUTPUT_SAMPLE_RATE = 24000;

function normalizeBase64(b64: string): string {
  const t = b64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = t.length % 4;
  return pad ? t + "=".repeat(4 - pad) : t;
}

function decodePcm16LeBase64(b64: string): Float32Array {
  const binary = atob(normalizeBase64(b64));
  const len = binary.length >> 1;
  const i16 = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    const lo = binary.charCodeAt(i * 2);
    const hi = binary.charCodeAt(i * 2 + 1);
    i16[i] = (hi << 8) | lo;
  }
  const f32 = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    f32[i] = i16[i] / 32768;
  }
  return f32;
}

export class Pcm24Player {
  private ctx: AudioContext | null = null;
  private nextTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    }
    return this.ctx;
  }

  async resume(): Promise<void> {
    const c = this.ensureContext();
    if (c.state === "suspended") await c.resume();
  }

  interrupt(): void {
    for (const s of this.activeSources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.activeSources.clear();
    if (this.ctx) this.nextTime = this.ctx.currentTime;
  }

  enqueueBase64Pcm(b64: string): void {
    if (!b64) return;
    const ctx = this.ensureContext();
    let samples: Float32Array;
    try {
      samples = decodePcm16LeBase64(b64);
    } catch {
      return;
    }
    if (samples.length === 0) return;

    const buffer = ctx.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
    const ch = new Float32Array(samples.length);
    ch.set(samples);
    buffer.copyToChannel(ch, 0);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime, this.nextTime);
    src.start(startAt);
    this.nextTime = startAt + buffer.duration;

    this.activeSources.add(src);
    src.onended = () => this.activeSources.delete(src);
  }

  close(): void {
    this.interrupt();
    void this.ctx?.close();
    this.ctx = null;
    this.nextTime = 0;
  }
}
