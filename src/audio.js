// WebAudio-synthesised elevator sounds. No files. Peaks ≤ −12 dBFS, nothing over 1 s.
// The AudioContext is created only from the speaker tap (a user gesture) and never before.

export function createAudio() {
  let ctx = null
  let master = null
  let volume = 50
  let enabled = false
  let chime = 'single'
  let motor = null

  function ensure() {
    if (ctx) return ctx
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = gainFor(volume)
    master.connect(ctx.destination)
    return ctx
  }
  const gainFor = (v) => 0.25 * Math.max(0, Math.min(100, v)) / 100 // 0.25 ≈ −12 dBFS ceiling

  function tone(freq, dur, { type = 'sine', gain = 1, attack = 0.005, at = 0, slideTo = null } = {}) {
    if (!enabled || !ctx) return
    const t0 = ctx.currentTime + at
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(gain, t0 + attack)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    o.connect(g); g.connect(master)
    o.start(t0); o.stop(t0 + dur + 0.02)
  }

  function noise(dur, { from = 400, to = 100, gain = 0.5, at = 0 } = {}) {
    if (!enabled || !ctx) return
    const t0 = ctx.currentTime + at
    const n = Math.floor(ctx.sampleRate * dur)
    const buf = ctx.createBuffer(1, n, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(from, t0)
    f.frequency.exponentialRampToValueAtTime(to, t0 + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    src.connect(f); f.connect(g); g.connect(master)
    src.start(t0); src.stop(t0 + dur)
  }

  const sounds = {
    ding() { if (chime === 'two-tone') { tone(1318.5, 0.12, { gain: 0.8 }); tone(880, 0.16, { gain: 0.8, at: 0.14 }) } else tone(880, 0.12, { gain: 0.9 }) },
    ding2() { tone(880, 0.12, { gain: 0.9 }); tone(880, 0.12, { gain: 0.9, at: 0.18 }) },
    doorHum() { tone(140, 0.45, { type: 'triangle', gain: 0.12, attack: 0.05 }) },
    click() { tone(1200, 0.02, { type: 'square', gain: 0.15, attack: 0.002 }) },
    bacon() { tone(523.25, 0.12, { gain: 0.6 }); tone(659.25, 0.16, { gain: 0.6, at: 0.12 }) },
    whoosh() { noise(0.7, { from: 400, to: 100, gain: 0.12 }) },
    boing() { tone(200, 0.25, { type: 'triangle', gain: 0.5, slideTo: 90 }) },
    roof() { tone(523.25, 0.14, { gain: 0.5 }); tone(659.25, 0.14, { gain: 0.5, at: 0.15 }); tone(783.99, 0.28, { gain: 0.5, at: 0.3 }) },
  }

  return {
    get enabled() { return enabled },
    get created() { return !!ctx },
    // The speaker tap: creates the context inside the gesture.
    enable(on) {
      enabled = !!on
      if (enabled) { const c = ensure(); if (c && c.state === 'suspended') c.resume().catch(() => {}) }
      else stopMotor()
    },
    setVolume(v) { volume = v; if (master) master.gain.value = gainFor(v) },
    setChime(id) { chime = id },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}) },
    suspend() { stopMotor(); if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}) },
    play(name) { const f = sounds[name]; if (f && enabled && ctx) f() },
    // Motor hum: 110 Hz at −30 dB, gain following speed.
    motor(speedFloorsPerMs) {
      if (!enabled || !ctx) return
      if (!motor) {
        const o = ctx.createOscillator(); const g = ctx.createGain()
        o.type = 'sawtooth'; o.frequency.value = 110
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300
        g.gain.value = 0
        o.connect(f); f.connect(g); g.connect(master); o.start()
        motor = { o, g }
      }
      const v = Math.min(1, Math.abs(speedFloorsPerMs) * 700) * 0.12 // 0.12 ≈ −30 dB below the ceiling
      motor.g.gain.setTargetAtTime(v, ctx.currentTime, 0.05)
    },
    stopMotor,
  }
  function stopMotor() {
    if (motor && ctx) { try { motor.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); motor.o.stop(ctx.currentTime + 0.3) } catch { /* ignore */ } }
    motor = null
  }
}
