/**
 * 8-bit synthesized sound effects via Web Audio API.
 * No external audio files — all sounds are generated programmatically.
 * Matches the pixel-art Songkran theme.
 */

let ctx = null
let masterGain = null
let bgmInterval = null
let bgmGain = null

/**
 * Must be called from a user gesture handler (click/touch) to unlock AudioContext on iOS.
 */
function unlock() {
  if (ctx) return
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    masterGain = ctx.createGain()
    masterGain.connect(ctx.destination)
    masterGain.gain.value = 0.5
    // Resume suspended context (iOS requires this)
    if (ctx.state === 'suspended') ctx.resume()
  } catch {
    // Web Audio not supported — all sfx calls will no-op
  }
}

function ensureResumed() {
  if (ctx?.state === 'suspended') ctx.resume()
}

/** Create an oscillator + gain, connect to master, auto-stop. */
function osc(type, freq, duration, gainVal = 0.3) {
  if (!ctx) return null
  ensureResumed()
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.value = gainVal
  o.connect(g)
  g.connect(masterGain)
  o.start(ctx.currentTime)
  o.stop(ctx.currentTime + duration)
  return { osc: o, gain: g }
}

/** Water shoot — quick descending chirp */
function shoot() {
  if (!ctx) return
  ensureResumed()
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'square'
  o.frequency.setValueAtTime(880, ctx.currentTime)
  o.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.08)
  g.gain.setValueAtTime(0.15, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
  o.connect(g)
  g.connect(masterGain)
  o.start(ctx.currentTime)
  o.stop(ctx.currentTime + 0.1)
}

/** Hit received — low thud */
function hit() {
  if (!ctx) return
  ensureResumed()
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(200, ctx.currentTime)
  o.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.12)
  g.gain.setValueAtTime(0.2, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
  o.connect(g)
  g.connect(masterGain)
  o.start(ctx.currentTime)
  o.stop(ctx.currentTime + 0.15)

  // Noise burst for impact texture
  const bufSize = ctx.sampleRate * 0.05
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3
  const noise = ctx.createBufferSource()
  const ng = ctx.createGain()
  noise.buffer = buf
  ng.gain.setValueAtTime(0.1, ctx.currentTime)
  ng.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)
  noise.connect(ng)
  ng.connect(masterGain)
  noise.start(ctx.currentTime)
  noise.stop(ctx.currentTime + 0.05)
}

/** Countdown beep — ascending pitch for 3, 2, 1 */
function countdown(n) {
  const freqs = [440, 660, 880]
  const freq = freqs[3 - n] ?? 880
  osc('square', freq, 0.08, 0.2)
}

/** Champion fanfare — 5-note ascending arpeggio */
function fanfare() {
  if (!ctx) return
  ensureResumed()
  const notes = [523, 659, 784, 1047, 1319] // C5 E5 G5 C6 E6
  notes.forEach((freq, i) => {
    const t = ctx.currentTime + i * 0.12
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'square'
    o.frequency.value = freq
    g.gain.setValueAtTime(0.2, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
    o.connect(g)
    g.connect(masterGain)
    o.start(t)
    o.stop(t + 0.15)
  })
}

/** Lobby BGM — simple looping chiptune pattern */
function bgmStart() {
  if (!ctx || bgmInterval) return
  ensureResumed()

  bgmGain = ctx.createGain()
  bgmGain.gain.value = 0.08
  bgmGain.connect(masterGain)

  const BPM = 90
  const beatDur = 60 / BPM
  let beat = 0
  let nextBeatTime = ctx.currentTime

  // Simple 8-bar pattern: bass + hi-hat
  const bassPattern = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0]
  const bassNotes   = [65, 65, 65, 82, 82, 82, 98, 98, 87, 87, 87, 82, 82, 98, 98, 98] // C2 E2 G2 F2 variants
  const hihatPattern = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]

  function scheduleBeatAt(t, idx) {
    // Bass
    if (bassPattern[idx]) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'triangle'
      o.frequency.value = bassNotes[idx]
      g.gain.setValueAtTime(1, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + beatDur * 0.8)
      o.connect(g)
      g.connect(bgmGain)
      o.start(t)
      o.stop(t + beatDur * 0.8)
    }

    // Hi-hat (noise burst)
    if (hihatPattern[idx]) {
      const bufSize = Math.floor(ctx.sampleRate * 0.02)
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1)
      const noise = ctx.createBufferSource()
      const g = ctx.createGain()
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 8000
      noise.buffer = buf
      g.gain.setValueAtTime(0.4, t)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.02)
      noise.connect(hp)
      hp.connect(g)
      g.connect(bgmGain)
      noise.start(t)
      noise.stop(t + 0.03)
    }
  }

  // Lookahead scheduler — schedule 100ms ahead to avoid timer jitter
  function schedule() {
    while (nextBeatTime < ctx.currentTime + 0.1) {
      scheduleBeatAt(nextBeatTime, beat % 16)
      nextBeatTime += beatDur
      beat++
    }
    bgmInterval = setTimeout(schedule, 50)
  }
  schedule()
}

function bgmStop() {
  if (bgmInterval) {
    clearTimeout(bgmInterval)
    bgmInterval = null
  }
  if (bgmGain) {
    bgmGain.disconnect()
    bgmGain = null
  }
}

function setMuted(muted) {
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.5
}

export const sfx = { unlock, shoot, hit, countdown, fanfare, bgmStart, bgmStop, setMuted }
