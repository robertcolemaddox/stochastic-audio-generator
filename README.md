# Random Noise Lab

A standalone browser-based random noise generator built with vanilla HTML, CSS, and JavaScript.

## Features

- White, pink, and brown noise
- Cryptographically secure random samples using `crypto.getRandomValues()`
- Adjustable duration, amplitude, and sample rate
- Real-time waveform visualization
- Browser playback through the Web Audio API
- WAV export
- Fully client-side — no server and no dependencies
- Responsive interface
- GitHub Pages compatible

## Important note about "true" randomness

This project deliberately calls its generator **secure randomness**, rather than claiming to produce physically true randomness.

`crypto.getRandomValues()` is designed to provide cryptographically strong random values. It is fundamentally different from `Math.random()`, but it is not a direct measurement of physical entropy such as radioactive decay or atmospheric noise.

## Run locally

Open `index.html` in a modern browser.

For best results when developing locally, use a simple static server such as:

```bash
python -m http.server
```

Then open the local address shown by Python.

## Technologies

- HTML5
- CSS3
- JavaScript
- Web Crypto API
- Web Audio API
- Canvas API

No frameworks or external dependencies are required.
