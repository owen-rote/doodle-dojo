/**
 * Streams 24 kHz 16-bit little-endian PCM audio received from
 * the Gemini Live native-audio model.
 */
export class Pcm24Player {
  private ctx: AudioContext | null = null;
  private nextStartTime = 0;
  private readonly sampleRate = 24000;

  private getCtx(): AudioContext {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext({ sampleRate: this.sampleRate });
      this.nextStartTime = 0;
    }
    return this.ctx;
  }

  /** Call on a user-gesture event (e.g. button click) to unlock AudioContext */
  async resume(): Promise<void> {
    const ctx = this.getCtx();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
  }

  /** Decode and schedule a base64-encoded PCM chunk for playback */
  enqueueBase64Pcm(base64: string): void {
    const ctx = this.getCtx();
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const samples = bytes.length / 2;
    const buffer = ctx.createBuffer(1, samples, this.sampleRate);
    const channel = buffer.getChannelData(0);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < samples; i++) {
      channel[i] = view.getInt16(i * 2, true) / 32768;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now, this.nextStartTime);
    source.start(startAt);
    this.nextStartTime = startAt + buffer.duration;
  }

  close(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.nextStartTime = 0;
  }
}
