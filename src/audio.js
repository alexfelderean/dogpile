// Procedural audio - no external files needed
let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

export function playBark() {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Create oscillator for the "yap" tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Sawtooth gives a rough, "barky" timbre
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);

    // Filter to soften harshness
    filter.type = 'lowpass';
    filter.frequency.value = 1200;

    // Quick attack, fast decay envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
}

export function playClick() {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Metallic click using layered sine waves for bell-like harmonics
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Resonant bandpass filter for metallic ring
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 8;

    // Layer multiple frequencies for metallic timbre
    const freqs = [600, 1500, 2400]; // Harmonically related
    for (const freq of freqs) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(filter);
        osc.start(now);
        osc.stop(now + 0.06);
    }

    // Sharp attack, quick decay with slight ring
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

    filter.connect(gain).connect(ctx.destination);
}
