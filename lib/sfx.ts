"use client";

export type SoundName = "jab" | "heavy" | "kick" | "slap" | "miss" | "time";

export interface SoundConfig {
  /** 0–1, applied to every generated sound. */
  volume: number;
  click: boolean;
  error: boolean;
  timeWarning: boolean;
}

let context: AudioContext | null = null;
let enabled = true;
let config: SoundConfig = {
  volume: 0.7,
  click: true,
  error: true,
  timeWarning: true,
};

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!context) {
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) return null;
    context = new AudioCtor();
  }
  if (context.state === "suspended") void context.resume();
  return context;
}

export function primeAudio() {
  audio();
}

export function setSoundEnabled(value: boolean) {
  enabled = value;
}

export function setSoundConfig(next: Partial<SoundConfig>) {
  config = { ...config, ...next };
}

function noiseBurst(
  ctx: AudioContext,
  at: number,
  duration: number,
  frequency: number,
  gainValue: number,
) {
  if (config.volume <= 0) return;
  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    const falloff = 1 - i / length;
    data[i] = (Math.random() * 2 - 1) * falloff ** 2;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = 1.1;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainValue * config.volume, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(at);
  source.stop(at + duration);
}

function thump(
  ctx: AudioContext,
  at: number,
  from: number,
  to: number,
  duration: number,
  gainValue: number,
  type: OscillatorType = "sine",
) {
  if (config.volume <= 0) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, at);
  oscillator.frequency.exponentialRampToValueAtTime(to, at + duration);
  gain.gain.setValueAtTime(gainValue * config.volume, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(at);
  oscillator.stop(at + duration);
}

export function playSound(name: SoundName) {
  if (!enabled) return;
  if (name === "miss" && !config.error) return;
  if (name === "time" && !config.timeWarning) return;
  if (name !== "miss" && name !== "time" && !config.click) return;
  const ctx = audio();
  if (!ctx) return;
  const now = ctx.currentTime + 0.001;

  if (name === "jab") {
    noiseBurst(ctx, now, 0.07, 2200, 0.055);
    thump(ctx, now, 180, 90, 0.08, 0.045);
    return;
  }
  if (name === "heavy") {
    noiseBurst(ctx, now, 0.13, 1500, 0.09);
    thump(ctx, now, 130, 55, 0.17, 0.09);
    return;
  }
  if (name === "kick") {
    noiseBurst(ctx, now, 0.16, 900, 0.1);
    thump(ctx, now, 95, 40, 0.22, 0.1);
    return;
  }
  if (name === "slap") {
    noiseBurst(ctx, now, 0.06, 3400, 0.11);
    noiseBurst(ctx, now + 0.008, 0.11, 1400, 0.05);
    thump(ctx, now, 320, 150, 0.09, 0.04, "triangle");
    return;
  }
  if (name === "time") {
    thump(ctx, now, 880, 660, 0.09, 0.05, "triangle");
    thump(ctx, now + 0.13, 660, 440, 0.13, 0.045, "triangle");
    return;
  }
  thump(ctx, now, 150, 70, 0.14, 0.06, "sawtooth");
  noiseBurst(ctx, now, 0.05, 700, 0.03);
}
