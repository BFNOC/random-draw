export const DRAWING_ROLL_INTERVAL_MS = 50
export const REVEAL_INTERVAL_MS = 60
export const REVEAL_TARGET_STEPS = 15
export const THREE_RESULT_DROP_MS = 760
export const THREE_FINAL_BURST_MS = 460
export const QUICK_SETUP_DELAY_MS = 2500

export const FULL_GRID_FILL_CONFIGS = {
  1: { columns: 1, preferredVw: 17 },
  2: { columns: 2, preferredVw: 12 },
  4: { columns: 2, preferredVw: 9 },
  8: { columns: 4, preferredVw: 7 },
  20: { columns: 5, preferredVw: 3.3 },
  40: { columns: 8, preferredVw: 2.25 },
  50: { columns: 10, preferredVw: 1.95 }
}

export const SUPPORTED_RESULT_SOUND_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/vnd.wave'
]

export const SYNTH_RESULT_NOTES = [
  { frequency: 523.25, start: 0, duration: 0.18, volume: 0.28 },
  { frequency: 659.25, start: 0.12, duration: 0.2, volume: 0.3 },
  { frequency: 783.99, start: 0.24, duration: 0.22, volume: 0.32 },
  { frequency: 1046.5, start: 0.42, duration: 0.48, volume: 0.34 }
]

export const CONFETTI_COLORS = ['#FFD700', '#FFA500', '#F4E0A5', '#C0C0C0', '#007AFF', '#5856D6']
