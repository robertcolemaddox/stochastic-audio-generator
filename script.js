const typeEl = document.getElementById("noiseType");
const durationEl = document.getElementById("duration");
const amplitudeEl = document.getElementById("amplitude");
const rateEl = document.getElementById("sampleRate");
const durationValue = document.getElementById("durationValue");
const amplitudeValue = document.getElementById("amplitudeValue");
const generateBtn = document.getElementById("generate");
const downloadBtn = document.getElementById("download");
const canvas = document.getElementById("waveform");
const ctx = canvas.getContext("2d");
const emptyState = document.getElementById("emptyState");
const waveTitle = document.getElementById("waveTitle");
const sampleCount = document.getElementById("sampleCount");
const durationReadout = document.getElementById("durationReadout");

let lastSamples = null;
let audioContext = null;
let currentSource = null;

function updateLabels() {
  durationValue.textContent = `${Number(durationEl.value).toFixed(1)} s`;
  amplitudeValue.textContent = Number(amplitudeEl.value).toFixed(2);
}
durationEl.addEventListener("input", updateLabels);
amplitudeEl.addEventListener("input", updateLabels);
updateLabels();

function secureRandomFloat() {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return (buffer[0] / 4294967296) * 2 - 1;
}

function generateSamples(type, count, amplitude) {
  const samples = new Float32Array(count);
  let brown = 0;
  let pinkB0 = 0, pinkB1 = 0, pinkB2 = 0, pinkB3 = 0, pinkB4 = 0, pinkB5 = 0, pinkB6 = 0;

  for (let i = 0; i < count; i++) {
    const white = secureRandomFloat();
    let value;

    if (type === "white") {
      value = white;
    } else if (type === "pink") {
      // Paul Kellet's efficient pink-noise approximation.
      pinkB0 = 0.99886 * pinkB0 + white * 0.0555179;
      pinkB1 = 0.99332 * pinkB1 + white * 0.0750759;
      pinkB2 = 0.96900 * pinkB2 + white * 0.1538520;
      pinkB3 = 0.86650 * pinkB3 + white * 0.3104856;
      pinkB4 = 0.55000 * pinkB4 + white * 0.5329522;
      pinkB5 = -0.7616 * pinkB5 - white * 0.0168980;
      value = pinkB0 + pinkB1 + pinkB2 + pinkB3 + pinkB4 + pinkB5 + pinkB6 + white * 0.5362;
      pinkB6 = white * 0.115926;
      value *= 0.11;
    } else {
      // Brown noise: integrate white noise, then normalize.
      brown = (brown + 0.02 * white) / 1.02;
      value = brown * 3.5;
    }
    samples[i] = Math.max(-1, Math.min(1, value * amplitude));
  }
  return samples;
}

function drawWaveform(samples) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = "#252929";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = h * i / 4;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  ctx.strokeStyle = "#3d423f";
  ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();

  ctx.strokeStyle = "#d7ff52";
  ctx.lineWidth = 1.15;
  ctx.beginPath();

  // Downsample for a useful overview rather than drawing every audio sample.
  const points = Math.min(Math.floor(w * 2), samples.length);
  const step = samples.length / points;
  for (let x = 0; x < points; x++) {
    const start = Math.floor(x * step);
    const end = Math.max(start + 1, Math.floor((x + 1) * step));
    let min = 1, max = -1;
    for (let i = start; i < end; i++) {
      const v = samples[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const px = x / (points - 1) * w;
    const y1 = h / 2 - max * h * .44;
    const y2 = h / 2 - min * h * .44;
    ctx.moveTo(px, y1);
    ctx.lineTo(px, y2);
  }
  ctx.stroke();
}

function playSamples(samples, sampleRate) {
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === "suspended") audioContext.resume();

  if (currentSource) {
    try { currentSource.stop(); } catch (_) {}
  }
  const buffer = audioContext.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples, 0);

  currentSource = audioContext.createBufferSource();
  currentSource.buffer = buffer;
  currentSource.connect(audioContext.destination);
  currentSource.start();
}

function wavBlob(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const write = (offset, text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (const sample of samples) {
    const s = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([view], { type: "audio/wav" });
}

generateBtn.addEventListener("click", () => {
  const sampleRate = Number(rateEl.value);
  const duration = Number(durationEl.value);
  const type = typeEl.value;
  const amplitude = Number(amplitudeEl.value);
  const count = Math.floor(sampleRate * duration);

  generateBtn.disabled = true;
  generateBtn.textContent = "Generating…";

  // Yield once so the button visibly updates before the CPU-heavy generation.
  setTimeout(() => {
    lastSamples = generateSamples(type, count, amplitude);
    drawWaveform(lastSamples);
    playSamples(lastSamples, sampleRate);

    waveTitle.textContent = `${type.toUpperCase()} NOISE`;
    sampleCount.textContent = `${count.toLocaleString()} samples`;
    durationReadout.textContent = `${duration.toFixed(2)} s`;
    emptyState.style.display = "none";
    downloadBtn.disabled = false;

    generateBtn.disabled = false;
    generateBtn.innerHTML = 'Generate noise <span>↗</span>';
  }, 20);
});

downloadBtn.addEventListener("click", () => {
  if (!lastSamples) return;
  const blob = wavBlob(lastSamples, Number(rateEl.value));
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `random-${typeEl.value}-noise.wav`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

typeEl.addEventListener("change", () => {
  if (lastSamples) {
    waveTitle.textContent = `${typeEl.value.toUpperCase()} NOISE`;
  }
});

window.addEventListener("resize", () => {
  if (lastSamples) drawWaveform(lastSamples);
});
