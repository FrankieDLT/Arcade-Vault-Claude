// Pin machine sounds (SPEC 26). Synthesized live with Web Audio: no files, nothing to download.
// Client only. The AudioContext is created lazily inside the crank click (browsers need a user gesture,
// iOS also needs resume()). If Web Audio is missing or throws, every function does nothing.

import type { PinRarity } from "./catalog";

export type PinSfxTier = { crankMs: number; revealMs: number; voices: number };

/** Each tier is a longer and more complex version of the previous one. */
export const PIN_SFX_TIERS: Record<PinRarity, PinSfxTier> = {
  common: { crankMs: 400, revealMs: 600, voices: 1 },
  rare: { crankMs: 550, revealMs: 900, voices: 2 },
  "super-rare": { crankMs: 700, revealMs: 1300, voices: 3 },
  "ultra-rare": { crankMs: 900, revealMs: 1800, voices: 4 },
  epic: { crankMs: 1100, revealMs: 2500, voices: 5 },
};

type Handle = { stop: () => void };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = false;
const playing = new Set<Handle>();

/** Creates (or reuses) the context and resumes it. Returns null when Web Audio is not available. */
function audio(): { ctx: AudioContext; out: GainNode } | null {
  try {
    if (typeof window === "undefined") return null;
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return master ? { ctx, out: master } : null;
  } catch {
    return null;
  }
}

function track(h: Handle, node: AudioScheduledSourceNode): void {
  playing.add(h);
  node.addEventListener("ended", () => playing.delete(h));
}

function stopAll(): void {
  for (const h of playing) {
    try {
      h.stop();
    } catch {
      // already stopped
    }
  }
  playing.clear();
}

/** One enveloped oscillator. `freq` may glide to `endFreq` over the note. */
function tone(
  c: AudioContext,
  out: AudioNode,
  o: {
    freq: number;
    endFreq?: number;
    start: number; // seconds from now
    dur: number; // seconds
    type?: OscillatorType;
    gain?: number;
    attack?: number;
  },
): void {
  const t0 = c.currentTime + o.start;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? "triangle";
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.endFreq) {
    osc.frequency.exponentialRampToValueAtTime(o.endFreq, t0 + o.dur);
  }
  const peak = o.gain ?? 0.2;
  const attack = Math.min(o.attack ?? 0.01, o.dur / 2);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g);
  g.connect(out);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.02);
  const h: Handle = {
    stop: () => {
      osc.stop();
      g.disconnect();
    },
  };
  track(h, osc);
}

/** A short filtered noise click, the body of a ratchet tick. */
function click(
  c: AudioContext,
  out: AudioNode,
  start: number,
  gain: number,
  freq: number,
): void {
  if (!noise) {
    noise = c.createBuffer(1, Math.floor(c.sampleRate * 0.05), c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = c.currentTime + start;
  const src = c.createBufferSource();
  src.buffer = noise;
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = 1.4;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035);
  src.connect(bp);
  bp.connect(g);
  g.connect(out);
  src.start(t0);
  src.stop(t0 + 0.04);
  const h: Handle = {
    stop: () => {
      src.stop();
      g.disconnect();
    },
  };
  track(h, src);
}

const NOTE = (semitonesFromA4: number) => 440 * 2 ** (semitonesFromA4 / 12);

/** Plain ratchet tick played the moment the crank is clicked. Stops any sound still playing. */
export function playCrankTick(): void {
  if (muted) return;
  const a = audio();
  if (!a) return;
  try {
    stopAll();
    click(a.ctx, a.out, 0, 0.9, 2400);
    click(a.ctx, a.out, 0.06, 0.7, 1800);
    tone(a.ctx, a.out, { freq: 160, endFreq: 90, start: 0, dur: 0.08, type: "square", gain: 0.12 });
  } catch {
    // audio is optional
  }
}

/** The crank turning, played when the server answers. Longer and fuller for rarer pins. */
export function playCrank(rarity: PinRarity): void {
  if (muted) return;
  const a = audio();
  if (!a) return;
  const tier = PIN_SFX_TIERS[rarity];
  const dur = tier.crankMs / 1000;
  try {
    // Voice 1: the ratchet, clicks that speed up.
    const clicks = Math.round(dur / 0.045);
    for (let i = 0; i < clicks; i++) {
      const t = dur * (1 - (1 - i / clicks) ** 1.6);
      click(a.ctx, a.out, t, 0.5, 1500 + i * 25);
    }
    // Voice 2: a rising whirr.
    if (tier.voices >= 2) {
      tone(a.ctx, a.out, { freq: 140, endFreq: 520, start: 0, dur, type: "sawtooth", gain: 0.05, attack: 0.05 });
    }
    // Voice 3: a bright shimmer on top.
    if (tier.voices >= 3) {
      tone(a.ctx, a.out, { freq: 880, endFreq: 1760, start: dur * 0.2, dur: dur * 0.8, type: "triangle", gain: 0.06, attack: 0.1 });
    }
    // Voice 4: a sub thump at the end of the turn.
    if (tier.voices >= 4) {
      tone(a.ctx, a.out, { freq: 90, endFreq: 40, start: dur - 0.15, dur: 0.3, type: "sine", gain: 0.3 });
    }
    // Voice 5: a bell that rings through.
    if (tier.voices >= 5) {
      tone(a.ctx, a.out, { freq: NOTE(12), start: dur * 0.5, dur: dur * 0.6, type: "sine", gain: 0.1, attack: 0.02 });
      tone(a.ctx, a.out, { freq: NOTE(19), start: dur * 0.6, dur: dur * 0.5, type: "sine", gain: 0.08, attack: 0.02 });
    }
  } catch {
    // audio is optional
  }
}

// Semitone offsets from A4 of the notes each tier climbs through (a major scale shape from C5).
const ARPEGGIO = [3, 7, 10, 15, 19, 22, 27];

/** The reveal jingle, played when the pin appears. Tiers: about 0.6 / 0.9 / 1.3 / 1.8 / 2.5 s. */
export function playReveal(rarity: PinRarity): void {
  if (muted) return;
  const a = audio();
  if (!a) return;
  const tier = PIN_SFX_TIERS[rarity];
  const dur = tier.revealMs / 1000;
  try {
    // Notes climb: the number of notes grows with the tier, the last one is held to the end.
    const count = 2 + tier.voices;
    const step = (dur * 0.55) / count;
    for (let i = 0; i < count; i++) {
      const base = ARPEGGIO[i % ARPEGGIO.length] + (i >= ARPEGGIO.length ? 12 : 0);
      const last = i === count - 1;
      const noteDur = last ? dur - i * step : step * 1.6;
      tone(a.ctx, a.out, { freq: NOTE(base), start: i * step, dur: noteDur, type: "square", gain: last ? 0.1 : 0.07 });
      // Harmony voices stack on every note: a fifth, an octave, then sparkle.
      if (tier.voices >= 2) tone(a.ctx, a.out, { freq: NOTE(base + 7), start: i * step, dur: noteDur, type: "triangle", gain: 0.08 });
      if (tier.voices >= 3) tone(a.ctx, a.out, { freq: NOTE(base + 12), start: i * step, dur: noteDur * 0.8, type: "triangle", gain: 0.07 });
    }
    // Ultra rare and epic: a swelling chord under the climb and a sparkle shower.
    if (tier.voices >= 4) {
      for (const semi of [-9, -5, 0]) {
        tone(a.ctx, a.out, { freq: NOTE(semi), start: dur * 0.4, dur: dur * 0.6, type: "sawtooth", gain: 0.04, attack: dur * 0.2 });
      }
      for (let i = 0; i < 6; i++) {
        tone(a.ctx, a.out, { freq: NOTE(24 + (i % 4) * 4), start: dur * 0.5 + i * 0.07, dur: 0.18, type: "sine", gain: 0.06 });
      }
    }
    // Epic: a bass drum hit, a second chord and a long bell tail.
    if (tier.voices >= 5) {
      tone(a.ctx, a.out, { freq: 110, endFreq: 40, start: 0, dur: 0.25, type: "sine", gain: 0.35 });
      for (const semi of [3, 7, 10, 15]) {
        tone(a.ctx, a.out, { freq: NOTE(semi), start: dur * 0.6, dur: dur * 0.4, type: "triangle", gain: 0.05, attack: 0.05 });
      }
      tone(a.ctx, a.out, { freq: NOTE(27), start: dur * 0.6, dur: dur * 0.4, type: "sine", gain: 0.08, attack: 0.02 });
    }
  } catch {
    // audio is optional
  }
}

/** Mutes or unmutes the machine. Muting also stops whatever is playing. */
export function setPinSfxMuted(value: boolean): void {
  muted = value;
  if (value) stopAll();
}
