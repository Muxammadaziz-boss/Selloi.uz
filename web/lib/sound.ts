export type AlertSoundKind = "message" | "handoff" | "order";

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/** Play a brief, pleasant Web Audio studio chime without needing external media assets. */
export function playNotificationChime(kind: AlertSoundKind): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes: Array<{ freq: number; offset: number; duration: number }> =
      kind === "order"
        ? [
            { freq: 523.25, offset: 0.0, duration: 0.14 },
            { freq: 659.25, offset: 0.09, duration: 0.14 },
            { freq: 783.99, offset: 0.18, duration: 0.22 },
          ]
        : kind === "handoff"
        ? [
            { freq: 783.99, offset: 0.0, duration: 0.14 },
            { freq: 1174.66, offset: 0.12, duration: 0.22 },
          ]
        : [
            { freq: 880.0, offset: 0.0, duration: 0.1 },
            { freq: 1174.66, offset: 0.08, duration: 0.14 },
          ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, now + note.offset);
      gain.gain.setValueAtTime(0.0001, now + note.offset);
      gain.gain.exponentialRampToValueAtTime(0.06, now + note.offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.offset + note.duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + note.offset);
      osc.stop(now + note.offset + note.duration + 0.02);
    }
  } catch {
    // Ignore audio errors when browser blocks autoplay before interaction
  }
}

/** Show a desktop notification when the tab is backgrounded and permission is granted. */
export function showBrowserNotification(title: string, body: string): void {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (!document.hidden) return;
    if (Notification.permission === "granted") {
      new Notification(title, { body: body.slice(0, 140) });
    }
  } catch {
    // Ignore unsupported Notification environments
  }
}
