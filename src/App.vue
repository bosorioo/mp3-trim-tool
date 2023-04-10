<script setup>
import { shallowRef, ref, nextTick, watch, onMounted, computed } from 'vue'
import DragDropInput from './components/DragDropInput.vue'
import SvgIcon from './components/SvgIcon.vue'
import VolumeButton from './components/VolumeButton.vue'
import TimeTrimInput from './components/TimeTrimInput.vue'

import { localStorageRef } from './modules/local-storage-ref.js'
import { AudioManager, AudioBufferClone } from './modules/audio-manager.js'
import { clickHrefAsAnchor } from './modules/download.js'
import { prefetchIcons } from './modules/prefetch-icons.js'
import { useDraggableEl } from './modules/draggable.js'
import { debounce } from './modules/debounce.js'
import EncoderWorker from './modules/encoder.worker.js?worker'

function getFileArrayBuffer (file) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader()
      reader.onload = (event) => {
        resolve(event.target.result)
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    } catch (err) {
      reject(err)
    }
  })
}

const fileInfo = ref(null)
const canvasEl = ref(null)
const seekHintEl = ref(null)
const trimStartEl = ref(null)
const trimEndEl = ref(null)
const audioManager = shallowRef(null)
const encodeProgress = shallowRef(null)
const encodedObjectUrl = shallowRef(null)
const isPlaying = shallowRef(false)
const volume = localStorageRef(0, 'volume', v => Number(v) || 0)
const isMuted = localStorageRef(false, 'muted', v => /true/.test(v))
const timeTrim = ref({ start: 0, end: Infinity })
const fadeEffect = ref({ start: 0, end: 0 })
const currentTime = shallowRef(-1)
const totalTime = computed(() => {
  const totalTime = audioManager.value && audioManager.value.audioBuffer &&
    audioManager.value.audioBuffer.duration
  return totalTime
})

const rendererOptions = {
  paddingX: 16,
  trimTimeStart: undefined,
  trimTimeEnd: undefined,
  plotColor: (ctx, canvas, details = {}) => {
    if (!canvas.sampleColorGradient) {
      const amplitude = 40
      const mid = Math.floor(canvas.height * 0.5)
      const gradient = ctx.createLinearGradient(0, mid - amplitude, 0, mid + amplitude)
      const colors = [ '#7320d2', '#5f1fa8' ]
      gradient.addColorStop(0, colors[0])
      gradient.addColorStop(0.5, colors[1])
      gradient.addColorStop(1, colors[0])
      canvas.sampleColorGradient = gradient
    }
    return details.trimmed
      ? '#fcedff'
      : canvas.sampleColorGradient
  }
}

function formatTimeToMMSSMS (seconds) {
  return [
    Math.floor(seconds / 60) % 60,
    ':',
    Math.floor(seconds % 60),
    '.',
    Math.floor((seconds - Math.floor(seconds)) * 100)
  ]
    .map(n => typeof n === 'number' ? String(n).padStart(2, '0') : n)
    .join('')
}

function getSeekPositionInfoFromX (x) {
  if (!audioManager.value || !audioManager.value.audioBuffer || !canvasEl.value) {
    return
  }
  const px = rendererOptions.paddingX * (canvasEl.value.clientWidth / canvasEl.value.width)
  const parent = seekHintEl.value.parentElement
  const rect = parent.getBoundingClientRect()
  const baseX = x - px - rect.x
  const pct = Math.min(1, Math.max(0, baseX) / (rect.width - 2 * px))
  const seekRect = seekHintEl.value.getBoundingClientRect()
  const seekContainerLeft = (px - seekRect.width * 0.5) + pct * (rect.width - 2 * px)
  const totalTime = audioManager.value && audioManager.value.audioBuffer &&
    audioManager.value.audioBuffer.duration
  const triggerWidth = 10
  const spanPosPct = baseX < triggerWidth || baseX > rect.width - 2 * px - triggerWidth
    ? pct
    : 0.5
  return {
    time: (totalTime || 0) * pct,
    pct,
    parent,
    baseX,
    seekContainerLeft,
    spanPosPct
  }
}

function updateSeekHint (x) {
  if (!audioManager.value || !audioManager.value.audioBuffer || !canvasEl.value) {
    return
  }

  const { parent, time, seekContainerLeft, spanPosPct } = getSeekPositionInfoFromX(x)
  const span = seekHintEl.value.firstElementChild

  if (Number.isNaN(time)) {
    parent.style.setProperty('--pos', '-100px')
  } else {
    span.textContent = formatTimeToMMSSMS(time)
    span.style.setProperty('--pos-pct', spanPosPct.toFixed(2))
    parent.style.setProperty('--pos', Math.round(seekContainerLeft) + 'px')
  }
}

function updateTrimHint () {
  if (!audioManager.value || !audioManager.value.audioBuffer ||
      !trimStartEl.value || !trimEndEl.value || !canvasEl.value) {
    return
  }
  const px = rendererOptions.paddingX * (canvasEl.value.clientWidth / canvasEl.value.width)
  const trimWidth = trimStartEl.value.clientWidth
  const { duration } = audioManager.value.audioBuffer
  const { start, end } = timeTrim.value
  const pctStart = start / duration
  const pctEnd = Math.min(end, duration) / duration
  const left = px - trimWidth + pctStart * (canvasEl.value.clientWidth - 2 * px) + 1
  const right = px + pctEnd * (canvasEl.value.clientWidth - 2 * px) - 1
  trimStartEl.value.style.left = `${Math.ceil(left)}px`
  trimEndEl.value.style.left = `${Math.floor(right)}px`
  if (currentTime.value < start) {
    seekAudio(null, start)
  } else if (currentTime.value > end) {
    seekAudio(null, end)
  }
}

function updateSeekBarPosition () {
  if (!canvasEl.value) {
    return
  }
  const el = canvasEl.value.parentElement
  const canvasWidth = canvasEl.value.clientWidth
  const widthFactor = canvasWidth / canvasEl.value.width
  const padding = rendererOptions.paddingX * widthFactor
  if (!audioManager.value || !audioManager.value.audioBuffer) {
    return el.style.setProperty('--progress', `${padding}px`)
  }
  const currentTimeValue = currentTime.value
  const totalTime = audioManager.value.audioBuffer.duration
  const timePct = totalTime
    ? currentTimeValue / totalTime
    : 0
  const value = Math.floor(padding + timePct * (canvasWidth - 2 * padding))
  el.style.setProperty('--progress', `${value}px`)
}

function seekAudio (x, time) {
  if (!time) {
    const seekPosition = getSeekPositionInfoFromX(x)
    time = seekPosition.time
  }
  time = Math.max(timeTrim.value.start, Math.min(time, timeTrim.value.end))
  time = Math.max(0, Math.min(time, totalTime.value))
  audioManager.value.start(time, audioManager.value.isPlaying)
}

function changeFade (type, delta) {
  fadeEffect.value[type] = Math.max(0, fadeEffect.value[type] + delta)
}

useDraggableEl(trimStartEl, {
  onDrag ({ x }) {
    const seekPosition = getSeekPositionInfoFromX(x)
    timeTrim.value.start = Math.min(
      seekPosition.time,
      timeTrim.value.end
    )
  },
  onClick () {
    seekAudio(0)
  }
})

useDraggableEl(trimEndEl, {
  onDrag ({ x }) {
    const seekPosition = getSeekPositionInfoFromX(x)
    timeTrim.value.end = Math.max(
      seekPosition.time,
      timeTrim.value.start
    )
  },
  onClick () {
    seekAudio(Infinity)
  }
})

async function onUploadFiles (files) {
  fileInfo.value = files[0]

  const fileBuffer = await getFileArrayBuffer(files[0])
  const manager = new AudioManager()
  await manager.decodeBuffer(fileBuffer)

  window.manager = manager
  isPlaying.value = manager.isPlaying
  timeTrim.value = { start: 0, end: Infinity }
  currentTime.value = 0
  fadeEffect.value = { start: 0, end: 0 }
  if (encodedObjectUrl.value) {
    URL.revokeObjectURL(encodedObjectUrl.value)
    encodedObjectUrl.value = null
  }
  manager.setGain(volume.value)
  manager.setMute(isMuted.value)
  manager.addOnEndCallback(() => { onClickStop() })
  audioManager.value = manager
  await nextTick()

  AudioManager.renderAudioBufferToCanvas(canvasEl.value, audioManager.value.audioBuffer, rendererOptions)
  const updateInterval = setInterval(() => {
    if (audioManager.value !== manager) {
      return clearInterval(updateInterval)
    }
    const newCurrentTime = audioManager.value.getCurrentTime()
    if (newCurrentTime >= timeTrim.value.end && isPlaying.value) {
      onClickStop()
    } else if (newCurrentTime !== currentTime.value) {
      currentTime.value = newCurrentTime
      updateSeekBarPosition()
    }
  }, 25)

  updateTrimHint()
}

function onClickPlayPause () {
  if (isPlaying.value) {
    audioManager.value.pause()
  } else {
    audioManager.value.resume()
  }
  isPlaying.value = !isPlaying.value
}

function onClickStop () {
  audioManager.value.start(timeTrim.value.start, false)
  isPlaying.value = false
}

function onClickEncode () {
  const encoderWorker = new EncoderWorker()
  encoderWorker.onerror = (err) => console.error(err)
  encoderWorker.onmessage = (event) => {
    const { data } = event
    if (data) {
      if ('progress' in data) {
        encodeProgress.value = data.progress
      }
      if ('encodedBuffer' in data) {
        if (encodedObjectUrl.value) {
          URL.revokeObjectURL(encodedObjectUrl.value)
        }
        const blob = new Blob([ data.encodedBuffer ], { type: 'audio/mp3' })
        const objectUrl = URL.createObjectURL(blob)
        encodedObjectUrl.value = objectUrl
        encodeProgress.value = null
        encoderWorker.terminate()
      }
    }
  }
  const audioBufferTransferable = new AudioBufferClone(audioManager.value.audioBuffer).getTransferable()
  encoderWorker.postMessage({
    audioBuffer: audioBufferTransferable.data,
    options: {
      timeFrom: timeTrim.value.start,
      timeTo: timeTrim.value.end
    }
  }, audioBufferTransferable.buffers)
}

function onClickDownload () {
  if (encodedObjectUrl.value) {
    const fileName = fileInfo.value.name
    clickHrefAsAnchor(encodedObjectUrl.value, fileName)
  }
}

function onClickClose () {
  audioManager.value.close()
  audioManager.value = null
}

function onWindowResize () {
  updateSeekBarPosition()
  updateSeekHint()
  updateTrimHint()
}

watch(volume, () => {
  if (audioManager.value) {
    audioManager.value.setGain(volume.value)
  }
})

watch(isMuted, () => {
  if (audioManager.value) {
    audioManager.value.setMute(isMuted.value)
  }
}, { immediate: true })

watch(timeTrim, () => {
  if (currentTime.value < timeTrim.value.start || currentTime.value > timeTrim.value.end) {
    const newTime = Math.max(timeTrim.value.start, Math.min(currentTime.value, timeTrim.value.end))
    currentTime.value = newTime
    seekAudio(undefined, newTime)
  }
  updateTrimHint()
  updateSeekBarPosition()
  rendererOptions.trimTimeStart = timeTrim.value.start
  rendererOptions.trimTimeEnd = timeTrim.value.end
}, { deep: true, flush: 'pre' })

const rerenderCanvasDebounced = debounce(() => {
  if (canvasEl.value && audioManager.value) {
    AudioManager.renderAudioBufferToCanvas(canvasEl.value, audioManager.value.audioBuffer, {
      ...rendererOptions,
      forceWaveFormRender: true
    })
  }
}, {
  delay: 25,
  triggerCallLimit: 5
})

watch([ timeTrim, fadeEffect ], () => {
  if (audioManager.value) {
    audioManager.value.addEffect({
      type: 'fadeIn',
      duration: fadeEffect.value.start,
      timeStart: timeTrim.value.start
    })
    audioManager.value.addEffect({
      type: 'fadeOut',
      duration: fadeEffect.value.end,
      timeStart: Math.min(audioManager.value.audioBuffer.duration, timeTrim.value.end) - fadeEffect.value.end
    })
    rerenderCanvasDebounced()
  }
}, { deep: true })

onMounted(() => {
  prefetchIcons([
    'play',
    'pause',
    'plus-circle',
    'minus-circle'
  ])
  window.addEventListener('resize', onWindowResize)
  window.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.shiftKey) {
      return
    }
    if (event.code === 'Space') {
      onClickPlayPause()
    } else if (/Arrow(Up|Down)/.test(event.code)) {
      const delta = 0.05 * (event.code === 'ArrowUp' ? 1 : -1)
      volume.value = Math.max(0, Math.min(volume.value + delta, 1))
    } else if (/Arrow(Right|Left)/.test(event.code)) {
      const delta = 5 * (event.code === 'ArrowRight' ? 1 : -1)
      seekAudio(undefined, currentTime.value + delta)
    } else if (event.code === 'KeyM') {
      isMuted.value = !isMuted.value
    }
  })
})
</script>

<template lang="pug">
header
  div MP3 Tool
main.column.p-y-3.items-center
  div.flex-1
  template(v-if="!audioManager")
    DragDropInput(
      @upload="onUploadFiles"
      extensions=".mp3,.wav"
    ).drag-drop.p-y-5
  template(v-else)
    div.column.items-center.full-width.flex-1.relative
      div.file__label.column.items-center
        div
          span File:&nbsp;
          b {{ fileInfo.name }}
        span Length: {{ formatTimeToMMSSMS(totalTime).slice(0, -3) }}
      button(@click="onClickClose").flat.icon.round.absolute.close-button.white
        SvgIcon(name="close-circle-outline" :size="32")
      div(
        @mousemove="updateSeekHint($event.clientX)"
      ).canvas__container.full-width.m-t-2
        div(ref="seekHintEl").absolute.seek-hint
          span
        div(ref="trimStartEl").absolute.trim-start
        div(ref="trimEndEl").absolute.trim-end
        canvas(
          ref="canvasEl"
          width="1600"
          height="260"
          @mousedown.left="seekAudio($event.clientX)"
        ).full-width
        span.time-label {{ formatTimeToMMSSMS(currentTime) }}
      div.actions__container.full-width
        div.columnn.m-l-7
          div.colum.items-center
            span.white.weight-600.font-14.m-b-1 Trim options
            TimeTrimInput(
              v-model:start="timeTrim.start"
              v-model:end="timeTrim.end"
              :duration="audioManager.audioBuffer ? audioManager.audioBuffer.duration : 0"
            )
          div.effects__container.column.m-t-6
            span.white.weight-600.font-14.m-b-2 Effects
            div.row.items-center
              div.column
                span.white.weight-600.font-12 Fade in
                div.row.items-center.m-t-1
                  span.fade-duration-label.white.weight-600 {{ fadeEffect.start }}s
                  button(
                    @click="changeFade('start', 1)"
                  ).m-l-1.mini-icon.round.flat.white
                    SvgIcon(name="plus-circle" :size="19")
                  button(
                    @click="changeFade('start', -1)"
                  ).m-l-1.mini-icon.round.flat.white
                    SvgIcon(name="minus-circle" :size="19")
              div.column.m-l-6
                span.white.weight-600.font-12 Fade out
                div.row.items-center.m-t-1
                  span.fade-duration-label.white.weight-600 {{ fadeEffect.end }}s
                  button(
                    @click="changeFade('end', 1)"
                  ).m-l-1.mini-icon.round.flat.white
                    SvgIcon(name="plus-circle" :size="19")
                  button(
                    @click="changeFade('end', -1)"
                  ).m-l-1.mini-icon.round.flat.white
                    SvgIcon(name="minus-circle" :size="19")
        div.column.items-center
          div.row
            button(@click="onClickPlayPause").icon.m-1
              SvgIcon(:name="isPlaying ? 'pause' : 'play'" :size="40")
            button(@click="onClickStop").icon.m-1
              SvgIcon(name="stop" :size="40")
            VolumeButton(v-model:value="volume" v-model:muted="isMuted").m-1
          div.m-t-7.column.items-center
            button(@click="onClickEncode" :disabled="!!encodeProgress").m-1
              template(v-if="encodeProgress === null")
                | Encode
              template(v-else)
                | Encoding... ({{ encodeProgress }}%)
            button(
              v-if="encodedObjectUrl"
              @click="onClickDownload"
            ).m-t-3
              | Download encoded mp3
        div
  div.flex-8
</template>

<style lang="stylus" scoped>
$back-mid-color = #5270bd
$center-margin-color = lighten($back-mid-color, 15%)

header
  height 52px
  position relative
  background $back-mid-color
  div
    position absolute
    font-size 52px
    font-weight 600
    letter-spacing 1.2px
    z-index 2
    left 32px
    bottom -16px
    text-shadow 5px 3px 8px #414141, -1px -1px 8px #414141
    color white

main
  background linear-gradient(180deg, $back-mid-color 0%, darken(#dee8ff, 6%) 24%, darken(#dee8ff, 9%) 44%, darken(#dee8ff, 10%) 46%, $center-margin-color 100%)
  align-items center
  flex 1

.file__label
  color white
  text-align center
  max-width 65vw

.drag-drop
  width 32vw
  height 12vh

.canvas__container
  position relative
  user-select none
  transform-origin center
  @media(max-width: 800px)
    margin-top 12px
    margin-bottom 32px
    .time-label
      bottom -32px
    canvas
        transform scaleY(2.5)
  @media(max-width: 560px)
    margin-top 12px
    margin-bottom 32px
    .time-label
      bottom -32px
    canvas
      transform scaleY(3.0)
  *
    user-select none
  canvas
    cursor crosshair
  &::after
    content ''
    position absolute
    top 20%
    bottom 20%
    z-index 4
    border-left solid 1px white
    border-right solid 1px white
    pointer-events none
    left var(--progress)

.close-button
  right 8px
  top -16px

.seek-hint
  .canvas__container:not(:hover) &
    opacity 0
  top 16px
  left var(--pos)
  --pos-pct 0
  border-top solid 8px white
  border-left solid 10px transparent
  border-right solid 10px transparent
  pointer-events none
  span
    color white
    font-weight 600
    font-size 12px
    position absolute
    left 0
    top 0
    transform translate(calc(-50% - 50% * (var(--pos-pct) - 0.5)), calc(-100% - 12px))
    transition transform 0.09s ease-out

$trim-height-pct = 65%
$trim-color = #49e
.trim-start
.trim-end
  width 10px
  height $trim-height-pct
  top (100% - $trim-height-pct) * 0.5
  cursor ew-resize
  z-index 3

.trim-start
  border-radius 8px 0 0 8px
  background $trim-color

.trim-end
  border-radius 0 8px 8px 0
  background $trim-color

.time-label
  position absolute
  text-align center
  pointer-events none
  left 0
  right 0
  bottom 10px
  color white
  user-select none
  font-weight 500

.effects__container
  *
    user-select none

.fade-duration-label
  min-width 28px

.actions__container
  display grid
  grid-template-columns 1fr 1fr 1fr
  grid-column-gap 24px
  @media(max-width: 800px)
    display flex
    flex-direction column-reverse
    align-items center
    > *
      margin-left 0
      margin-bottom 24px
</style>
