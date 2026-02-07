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

// === XTAL-STYLE AMBIENT BREAKBEAT ===
// Approximation of Aphex Twin's "Xtal" rhythm for educational purposes
// ~92 BPM, shuffled breakbeat pattern with ambient feel

let musicPlaying = false;
let musicInterval = null;
let beatIndex = 0;

// Xtal-style pattern: 16 steps at ~92 BPM
// K=kick, S=snare, H=closed hat, O=open hat, .=rest
// Pattern approximates the shuffled breakbeat feel
const PATTERN = {
    // Step:  0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    hihat: [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0],
    open: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1]
};

const BPM = 92;
const STEP_MS = (60000 / BPM) / 4; // 16th notes

function playKick(ctx, time) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);

    gain.gain.setValueAtTime(0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.2);
}

function playSnare(ctx, time) {
    // Noise burst for snare
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);

    // Add tonal component
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 180;
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.15, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

    noise.connect(filter).connect(gain).connect(ctx.destination);
    osc.connect(oscGain).connect(ctx.destination);

    noise.start(time);
    noise.stop(time + 0.15);
    osc.start(time);
    osc.stop(time + 0.05);
}

function playHiHat(ctx, time, open = false) {
    const bufferSize = ctx.sampleRate * (open ? 0.2 : 0.05);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;

    const gain = ctx.createGain();
    const vol = open ? 0.12 : 0.08;
    const decay = open ? 0.18 : 0.04;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + decay);

    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(time);
    noise.stop(time + (open ? 0.2 : 0.05));
}

function playBeat() {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const step = beatIndex % 16;

    if (PATTERN.kick[step]) playKick(ctx, now);
    if (PATTERN.snare[step]) playSnare(ctx, now);
    if (PATTERN.open[step]) playHiHat(ctx, now, true);
    else if (PATTERN.hihat[step]) playHiHat(ctx, now, false);

    beatIndex++;
}

export function startMusic() {
    if (musicPlaying) return;
    musicPlaying = true;
    beatIndex = 0;
    getAudioContext(); // Initialize
    musicInterval = setInterval(playBeat, STEP_MS);
}

export function stopMusic() {
    if (!musicPlaying) return;
    musicPlaying = false;
    if (musicInterval) {
        clearInterval(musicInterval);
        musicInterval = null;
    }
}

export function toggleMusic() {
    if (musicPlaying) stopMusic();
    else startMusic();
    return musicPlaying;
}

export function isMusicPlaying() {
    return musicPlaying;
}
