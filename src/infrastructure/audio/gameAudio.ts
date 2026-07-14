import type { GameSettings } from "../../domain/model/player";

export type GameSound = "talk" | "page" | "confirm" | "notice";

let audioContext: AudioContext | undefined;

export function isGameSoundEnabled(settings: Pick<GameSettings, "muted" | "volume">) {
  return !settings.muted && settings.volume > 0;
}

export function playGameSound(sound: GameSound, settings: Pick<GameSettings, "muted" | "volume">) {
  if (!isGameSoundEnabled(settings) || typeof window === "undefined") return false;
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextClass) return false;
  try {
    audioContext ??= new AudioContextClass();
    const play = () => synthesize(audioContext!, sound, settings.volume);
    if (audioContext.state === "suspended") {
      void audioContext
        .resume()
        .then(play)
        .catch(() => undefined);
    } else {
      play();
    }
    return true;
  } catch {
    return false;
  }
}

function synthesize(context: AudioContext, sound: GameSound, volume: number) {
  const notes: Record<GameSound, Array<[number, number, number]>> = {
    talk: [
      [523, 0, 0.07],
      [659, 0.07, 0.09]
    ],
    page: [[440, 0, 0.045]],
    confirm: [
      [587, 0, 0.06],
      [784, 0.065, 0.11]
    ],
    notice: [
      [392, 0, 0.07],
      [523, 0.08, 0.12]
    ]
  };
  const start = context.currentTime;
  for (const [frequency, delay, duration] of notes[sound]) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const noteStart = start + delay;
    const noteEnd = noteStart + duration;
    oscillator.type = sound === "page" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.075), noteStart + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.01);
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
