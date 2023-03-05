import lamejs from 'lamejs'

export class AudioManager {

  static applyExponentialGainToBuffer (audioBuffer, timeStart, duration = 6, rising = true) {
    timeStart = Math.max(0, Math.min(timeStart, audioBuffer.duration))
    duration = Math.min(duration, audioBuffer.duration - timeStart)
    if (duration <= 0) {
      return
    }
    const timeEnd = timeStart + duration
    const sampleIndexStartPct = Math.max(0, Math.min(timeStart / audioBuffer.duration, 1))
    const sampleIndexEndPct = Math.max(0, Math.min(timeEnd / audioBuffer.duration, 1))
    for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex++) {
      const samples = audioBuffer.getChannelData(channelIndex)
      const indexFrom = Math.floor(samples.length * sampleIndexStartPct)
      const indexTo = Math.floor(samples.length * sampleIndexEndPct)
      for (let index = indexFrom; index <= indexTo; index++) {
        const t = (index - indexFrom) / (indexTo - indexFrom)
        const factor = Math.sin(t * Math.PI / 2)
        samples[index] = samples[index] * (rising ? factor : 1 - factor)
      }
      audioBuffer.copyToChannel(samples, channelIndex)
    }
  }

  static cloneAudioBuffer (audioBuffer) {
    const result = new AudioBuffer({
      length: audioBuffer.length,
      numberOfChannels: audioBuffer.numberOfChannels,
      sampleRate: audioBuffer.sampleRate
    })
    for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex++) {
      const samples = audioBuffer.getChannelData(channelIndex)
      result.copyToChannel(samples, channelIndex)
    }
    return result
  }

  static renderAudioBufferToCanvas (canvas, audioBuffer, options = {}) {
    const {
      plotColor = '#3d5',
      paddingX = 0,
      amplitudeFactor = 0.5
    } = options
    const ctx = canvas.getContext('2d')
    const width = canvas.width - 2 * paddingX
    const height = canvas.height
    const midY = height >> 1
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.lineWidth = 1
    const samples = [
      audioBuffer.getChannelData(0),
      audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : []
    ]
    let max = 1
    // for (let index = 0; index < audioBuffer.length; index++) {
    //   max = Math.max(
    //     Math.abs(samples[0][index]),
    //     Math.abs(samples[1][index] || 0),
    //     max
    //   )
    // }
    const ampMax = Math.max(Math.floor(height * amplitudeFactor), 20)
    const halfWindowSize = ((audioBuffer.length / width) >> 2) - 1
    for (let x = 0; x < width; x++) {
      const pctX = x / width
      const sampleIndexBase = Math.floor(pctX * audioBuffer.length)
      const sampleIndexFrom = Math.max(0, sampleIndexBase - halfWindowSize)
      const sampleIndexTo = Math.min(audioBuffer.length - 1, sampleIndexBase + halfWindowSize)
      let sampleValueTop = 0
      for (let sampleIndex = sampleIndexFrom; sampleIndex <= sampleIndexTo; sampleIndex++) {
        sampleValueTop += Math.abs(samples[0][sampleIndex])
      }
      sampleValueTop /= sampleIndexTo - sampleIndexFrom + 1
      const ampTop = Math.max(1, Math.floor((sampleValueTop / max) * ampMax))
      ctx.strokeStyle = typeof plotColor === 'function'
        ? plotColor(ctx, canvas, sampleIndexBase)
        : plotColor
      ctx.beginPath()
      ctx.moveTo(x + paddingX, midY + ampTop)
      ctx.lineTo(x + paddingX, midY - ampTop)
      ctx.stroke()
    }
  }

  static audioBufferToMp3Chunks (audioBuffer, options = {}) {
    const {
      kbps = 256,
      onProgress,
      timeFrom = 0,
      timeTo = Infinity
    } = options
    const mp3Encoder = new lamejs.Mp3Encoder(audioBuffer.numberOfChannels, audioBuffer.sampleRate, kbps)
    const channels = [
      audioBuffer.getChannelData(0),
      audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : []
    ]
      .map(channel => {
        const sampleFrom = Math.max(0, Math.floor(timeFrom / audioBuffer.duration * channel.length))
        const sampleTo = Math.min(channel.length, Math.ceil(timeTo / audioBuffer.duration * channel.length))
        return channel.slice(sampleFrom, sampleTo)
      })
    const length = channels[0].length
    const blockSize = 576 * 2
    const resultChunks = []
    const leftData = new Int16Array(blockSize)
    const rightData = audioBuffer.numberOfChannels > 1 ? new Int16Array(blockSize) : undefined

    const totalBlocks = Math.ceil(length / blockSize)
    let blocksProcessed = 0

    for (let sampleBaseIndex = 0; sampleBaseIndex < length; sampleBaseIndex += blockSize) {
      const thisBlockSize = Math.min(length - sampleBaseIndex, blockSize)
      for (let sampleDeltaIndex = 0; sampleDeltaIndex < thisBlockSize; sampleDeltaIndex++) {
        const sampleIndex = sampleDeltaIndex + sampleBaseIndex
        let sampleClampedFloat = Math.max(-1, Math.min(channels[0][sampleIndex], 1))
        let sampleInt16 = Math.floor(
          sampleClampedFloat >= 0
            ? sampleClampedFloat * 32767
            : sampleClampedFloat * 32768
        )
        leftData[sampleDeltaIndex] = sampleInt16
        if (audioBuffer.numberOfChannels > 1) {
          sampleClampedFloat = Math.max(-1, Math.min(channels[1][sampleIndex], 1))
          sampleInt16 = Math.floor(
            sampleClampedFloat >= 0
              ? sampleClampedFloat * 32767
              : sampleClampedFloat * 32768
          )
          rightData[sampleDeltaIndex] = sampleInt16
        }
      }
      const encodedChunk = thisBlockSize !== blockSize
        ? mp3Encoder.encodeBuffer(leftData.slice(0, thisBlockSize), rightData && rightData.slice(0, thisBlockSize))
        : mp3Encoder.encodeBuffer(leftData, rightData)
      resultChunks.push(encodedChunk)
      blocksProcessed++
      if (typeof onProgress === 'function') {
        onProgress(blocksProcessed, totalBlocks)
      }
    }
    resultChunks.push(mp3Encoder.flush())
    return resultChunks
  }

  constructor () {
    this.context = new AudioContext()
    this.audioBufferOriginal = null
    this.audioBuffer = null

    this.gain = new GainNode(this.context)
    this.gain.connect(this.context.destination)
    this.volume = 1
    this.isMute = false

    this.hasStarted = false
    this.isPlaying = false
    this.lastPlayTimestamp = undefined
    this.seekTimestamp = 0

    this.effects = []
    this.onEndCallbacks = []
  }

  decodeBuffer (arrayBuffer) {
    return new Promise((resolve, reject) => {
      try {
        this.context.decodeAudioData(arrayBuffer, (audioBuffer) => {
          this.audioBufferOriginal = audioBuffer
          this.audioBuffer = audioBuffer
          for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex++) {
            const samples = audioBuffer.getChannelData(channelIndex)
            for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex++) {
              samples[sampleIndex] = samples[sampleIndex] * 1
            }
            audioBuffer.copyToChannel(samples, channelIndex)
          }
          resolve(audioBuffer)
        }, reject)
      } catch (err) {
        reject(err)
      }
    })
  }

  addEffect (type, params) {
    let effect = this.effects.find(eff => eff.type === type)
    let applyAllEffects = false
    let mustClone = false

    if (effect) {
      mustClone = true
    } else {
      effect = { type }
      this.effects.push(effect)
    }

    Object.assign(effect, params)

    if (mustClone || this.audioBuffer === this.audioBufferOriginal) {
      this.audioBuffer = AudioManager.cloneAudioBuffer(this.audioBufferOriginal)
      applyAllEffects = true
    }

    const effectsToApply = applyAllEffects ? this.effects : [ effect ]
    for (const effect of effectsToApply) {
      if (/^fade(In|Out)$/.test(effect.type)) {
        AudioManager.applyExponentialGainToBuffer(
          this.audioBuffer,
          effect.timeStart || 0,
          effect.duration,
          effect.type === 'fadeIn'
        )
      }
    }

    this.start(this.getCurrentTime(), this.isPlaying)
  }

  addOnEndCallback (callback) {
    if (typeof callback === 'function') {
      this.onEndCallbacks.push(callback)
      return true
    }
  }

  setMute (isMute) {
    this.isMute = isMute
    this.setGain(this.volume)
  }

  setGain (value) {
    value = Math.max(0, Math.min(value, 5))
    this.volume = value
    this.gain.gain.value = this.isMute
      ? 0
      : this.volume
  }

  getGain () {
    return this.isMute
      ? 0
      : this.gain.gain.value
  }

  getVolume () {
    return this.volume
  }

  getCurrentTime () {
    let time = this.seekTimestamp
    if (this.lastPlayTimestamp !== undefined) {
      time += this.context.currentTime - this.lastPlayTimestamp
    }
    return time
  }

  start (time = 0, play = true) {
    if (!this.audioBuffer) {
      return
    }
    if (this.source) {
      this.source.stop()
      this.source.disconnect()
    }
    const source = this.context.createBufferSource()
    source.buffer = this.audioBuffer
    source.connect(this.gain)
    source.start(0, time > this.audioBuffer.duration ? this.audioBuffer.duration : time)
    source.onended = () => {
      if (this.source === source) {
        this.seekTimestamp += this.context.currentTime - this.lastPlayTimestamp
        this.lastPlayTimestamp = undefined
        this.isPlaying = false
        this.hasStarted = false
        this.onEndCallbacks.forEach(cb => cb())
      }
    }
    this.source = source
    this.hasStarted = true
    this.seekTimestamp = 0
    this.lastPlayTimestamp = this.context.currentTime - time
    this.isPlaying = true
    if (play) {
      this.context.resume()
    } else {
      this.pause()
    }
  }

  resume () {
    if (!this.hasStarted) {
      this.start()
    } else if (!this.isPlaying) {
      this.context.resume()
      this.isPlaying = true
      this.lastPlayTimestamp = this.context.currentTime
    }
  }

  pause () {
    if (this.isPlaying) {
      this.context.suspend()
      this.isPlaying = false
      this.seekTimestamp += this.context.currentTime - this.lastPlayTimestamp
      this.lastPlayTimestamp = undefined
    }
  }

  close () {
    this.gain.disconnect()
    this.context.suspend()
    this.context.close()
  }

}

export class AudioBufferClone {

  constructor (audioBuffer) {
    this.duration = audioBuffer.duration
    this.length = audioBuffer.length
    this.numberOfChannels = audioBuffer.numberOfChannels
    this.sampleRate = audioBuffer.sampleRate
    this.isAudioBufferClone = true
    this.channels = audioBuffer.channels || [
      new Float32Array(audioBuffer.getChannelData(0)),
      new Float32Array(audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : [])
    ]
  }

  getChannelData (index) {
    return this.channels[index]
  }

  getTransferable () {
    return {
      data: { ...this },
      buffers: this.channels.map(channel => channel.buffer).filter(v => v)
    }
  }

}
