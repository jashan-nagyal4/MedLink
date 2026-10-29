/**
 * Web Audio API Emergency Siren & Notification Synthesizer
 * 
 * Synthesizes dual-tone emergency ambulance and hospital triage sirens
 * directly in the browser with 0 external sound files or network dependencies.
 * Complies with browser Autoplay Policy and audio context suspension lifecycles.
 */

let audioCtx = null;
let sirenOscillator = null;
let sirenGain = null;
let sirenInterval = null;
let isPlaying = false;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Start dual-tone emergency triage siren (850Hz <-> 650Hz)
 */
export function playEmergencySiren({ volume = 0.2 } = {}) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    // If already playing, stop previous instance first
    stopEmergencySiren();

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    // Smooth ramp-up to prevent click/pop
    gain.gain.exponentialRampToValueAtTime(Math.max(0.01, volume), ctx.currentTime + 0.1);
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth'; // Gives urgent emergency tone
    osc.frequency.setValueAtTime(850, ctx.currentTime);
    osc.connect(gain);
    osc.start();

    sirenOscillator = osc;
    sirenGain = gain;
    isPlaying = true;

    let isHigh = true;
    sirenInterval = setInterval(() => {
      if (!sirenOscillator || !audioCtx) return;
      const targetFreq = isHigh ? 650 : 850;
      isHigh = !isHigh;
      try {
        sirenOscillator.frequency.cancelScheduledValues(audioCtx.currentTime);
        sirenOscillator.frequency.exponentialRampToValueAtTime(targetFreq, audioCtx.currentTime + 0.15);
      } catch {
        // Safe fallback
        sirenOscillator.frequency.setValueAtTime(targetFreq, audioCtx.currentTime);
      }
    }, 400);

    return true;
  } catch (err) {
    console.warn("AudioContext siren playback failed:", err.message);
    return false;
  }
}

/**
 * Stop emergency siren immediately with smooth fadeout
 */
export function stopEmergencySiren() {
  if (sirenInterval) {
    clearInterval(sirenInterval);
    sirenInterval = null;
  }

  if (sirenGain && audioCtx) {
    try {
      sirenGain.gain.cancelScheduledValues(audioCtx.currentTime);
      sirenGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.08);
    } catch {
      // Ignore
    }
  }

  setTimeout(() => {
    if (sirenOscillator) {
      try {
        sirenOscillator.stop();
        sirenOscillator.disconnect();
      } catch {
        // Ignore
      }
      sirenOscillator = null;
    }
    sirenGain = null;
    isPlaying = false;
  }, 100);
}

/**
 * Check if siren is currently active
 */
export function isSirenActive() {
  return isPlaying;
}

/**
 * Pleasant success chime for incident accepted / ambulance arrived
 */
export function playSuccessChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);

      gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + idx * 0.1 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.1 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.1);
      osc.stop(ctx.currentTime + idx * 0.1 + 0.4);
    });
  } catch (err) {
    console.warn("Success chime failed:", err.message);
  }
}

/**
 * Warning triple-beep for escalation or critical alert
 */
export function playWarningBeep() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    [0, 0.18, 0.36].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(950, ctx.currentTime + delay);

      gain.gain.setValueAtTime(0.001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.14);
    });
  } catch (err) {
    console.warn("Warning beep failed:", err.message);
  }
}
