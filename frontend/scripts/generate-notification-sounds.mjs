import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const sampleRate = 44_100
const outputDirectory = fileURLToPath(
  new URL('../public/sounds/notifications/', import.meta.url),
)

const presets = {
  'soft-chime.wav': [
    [659.25, 0, 0.58, 0.72],
    [783.99, 0.09, 0.58, 0.58],
    [987.77, 0.18, 0.62, 0.44],
  ],
  'clear-bell.wav': [
    [987.77, 0, 0.72, 0.82],
    [1318.51, 0.075, 0.62, 0.5],
  ],
  'digital-ping.wav': [
    [1318.51, 0, 0.34, 0.78],
    [1975.53, 0.018, 0.24, 0.24],
  ],
  'double-tone.wav': [
    [698.46, 0, 0.42, 0.7],
    [1046.5, 0.24, 0.5, 0.74],
  ],
  'urgent-alert.wav': [
    [783.99, 0, 0.3, 0.72],
    [1046.5, 0.13, 0.32, 0.62],
    [783.99, 0.38, 0.3, 0.72],
    [1174.66, 0.51, 0.38, 0.66],
  ],
}

function renderPreset(tones) {
  const duration = Math.max(...tones.map(([, start, length]) => start + length)) + 0.24
  const samples = new Float64Array(Math.ceil(duration * sampleRate))

  for (const [frequency, start, length, level] of tones) {
    const firstSample = Math.floor(start * sampleRate)
    const lastSample = Math.min(samples.length, Math.ceil((start + length) * sampleRate))
    for (let sampleIndex = firstSample; sampleIndex < lastSample; sampleIndex += 1) {
      const age = sampleIndex / sampleRate - start
      const attack = Math.min(1, age / 0.012)
      const decay = Math.exp(-4.8 * age / length)
      const envelope = attack * decay * level
      const phase = 2 * Math.PI * frequency * age
      samples[sampleIndex] += envelope * (
        Math.sin(phase)
        + Math.sin(phase * 2.005) * 0.2
        + Math.sin(phase * 3.01) * 0.07
      )
    }
  }

  for (const [delaySeconds, amount] of [[0.075, 0.12], [0.145, 0.055]]) {
    const delaySamples = Math.floor(delaySeconds * sampleRate)
    for (let sampleIndex = delaySamples; sampleIndex < samples.length; sampleIndex += 1) {
      samples[sampleIndex] += samples[sampleIndex - delaySamples] * amount
    }
  }

  const peak = samples.reduce((maximum, sample) => Math.max(maximum, Math.abs(sample)), 0)
  const scale = peak > 0 ? 0.78 / peak : 1
  return encodeWave(samples, scale)
}

function encodeWave(samples, scale) {
  const dataLength = samples.length * 2
  const output = Buffer.alloc(44 + dataLength)
  output.write('RIFF', 0)
  output.writeUInt32LE(36 + dataLength, 4)
  output.write('WAVE', 8)
  output.write('fmt ', 12)
  output.writeUInt32LE(16, 16)
  output.writeUInt16LE(1, 20)
  output.writeUInt16LE(1, 22)
  output.writeUInt32LE(sampleRate, 24)
  output.writeUInt32LE(sampleRate * 2, 28)
  output.writeUInt16LE(2, 32)
  output.writeUInt16LE(16, 34)
  output.write('data', 36)
  output.writeUInt32LE(dataLength, 40)

  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample * scale))
    output.writeInt16LE(Math.round(clamped * 32767), 44 + index * 2)
  })
  return output
}

await mkdir(outputDirectory, { recursive: true })
await Promise.all(Object.entries(presets).map(([fileName, tones]) =>
  writeFile(new URL(`../public/sounds/notifications/${fileName}`, import.meta.url), renderPreset(tones))))

console.log(`Generated ${Object.keys(presets).length} notification sounds in ${outputDirectory}`)
