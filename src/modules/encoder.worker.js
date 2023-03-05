import { AudioManager, AudioBufferClone } from './audio-manager'

function encodeAudioBuffer (buffer, options) {
  const onProgress = (blocksProcessed, blocksTotal) => {
    const pct = blocksProcessed / blocksTotal
    globalThis.postMessage({ progress: pct })
  }
  const chunks = AudioManager.audioBufferToMp3Chunks(buffer, { ...options, onProgress })
  const blob = new Blob(chunks, { type: 'audio/mp3' })
  const objectUrl = URL.createObjectURL(blob)
  return objectUrl
}

globalThis.onmessage = (event) => {
  const { audioBuffer, options } = event.data
  const audioBufferInstance = new AudioBufferClone(audioBuffer)
  const objectUrl = encodeAudioBuffer(audioBufferInstance, options)
  globalThis.postMessage({ objectUrl })
}
