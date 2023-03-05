<script setup>
import { ref, watch } from 'vue'
import SvgIcon from './SvgIcon.vue'

import { prefetchIcons } from '../modules/prefetch-icons.js'

const props = defineProps({
  value: {
    type: Number,
    default: 1
  },
  muted: {
    type: Boolean,
    default: false
  },
  size: {
    type: Number,
    default: 40
  }
})

const emit = defineEmits([
  'update:value',
  'update:muted'
])

const sliderEl = ref(null)
const sliderButtonEl = ref(null)
const sliderTrackEl = ref(null)
const buttonIcon = ref('volume-high')
const slidingCounter = ref(0)
const isSliding = ref(false)

function getSliderValueFromMouseX (x) {
  if (!sliderTrackEl.value) {
    return props.value
  }

  const rect = sliderTrackEl.value.getBoundingClientRect()
  const raw = (x - rect.x) / rect.width
  const overflown = x < rect.x || x >= rect.x + rect.width
  const pct = Math.max(0, Math.min(raw, 1))
  return { pct, raw, overflown }
}

function onMouseDownSlider (event) {
  const result = getSliderValueFromMouseX(event.clientX)
  if (event.target !== sliderButtonEl.value && result.overflown) {
    return
  }
  emit('update:value', result.pct)
  const slideCounterId = ++slidingCounter.value
  isSliding.value = true
  const onMouseMove = (event) => {
    const sliderValue = getSliderValueFromMouseX(event.clientX)
    emit('update:value', sliderValue.pct)
  }
  const onMouseUp = (event) => {
    if (event.which === 1) {
      cleanUp()
    }
  }
  const cleanUp = () => {
    window.removeEventListener('mousemove', onMouseMove, { capture: true, passive: true })
    window.removeEventListener('blur', cleanUp)
    window.removeEventListener('mouseup', onMouseUp)
    setTimeout(() => {
      if (slidingCounter.value === slideCounterId) {
        isSliding.value = false
      }
    }, 1e3)
  }
  window.addEventListener('mousemove', onMouseMove, { capture: true, passive: true })
  window.addEventListener('blur', cleanUp, { once: true })
  window.addEventListener('mouseup', onMouseUp)
}

const iconsByLevel = [
  { icon: 'volume-high', level: 0.33 },
  { icon: 'volume-medium', level: Number.EPSILON },
  { icon: 'volume-low', level: 0 },
  { icon: 'volume-off', level: -1 }
]

watch(() => [ props.value, props.muted ], () => {
  if (props.muted) {
    buttonIcon.value = 'volume-off'
  } else {
    const iconData = iconsByLevel.find(({ level }) => level <= props.value)
    if (iconData) {
      buttonIcon.value = iconData.icon
    }
  }
}, { immediate: true })


prefetchIcons(iconsByLevel.map(({ icon }) => icon))
</script>

<template lang="pug">
div(:class="{ sliding: isSliding }").root.row.relative
  button(@click="$emit('update:muted', !props.muted)").icon
    SvgIcon(:name="buttonIcon" :size="size")
  div.spacer
  div.slider__anim-container.absolute
    div(
      ref="sliderEl"
      :style="{ '--progress': value }"
    ).slider__container
      div(
        ref="sliderTrackEl"
        @mousedown.left="onMouseDownSlider"
      ).slider__track
      div(
        ref="sliderButtonEl"
        @mousedown.left="onMouseDownSlider"
      ).slider__button
</template>

<style lang="stylus" scoped>
$slider-width = 144px
$margin = 8px

button
  overflow visible

.slider__anim-container
  width 0
  height 100%
  background #efefef
  left "calc(100% + %s)" % $margin
  overflow hidden
  transition width 0.125s ease-out

.slider__container
  width $slider-width
  position relative
  height 100%
  display flex
  justify-content center
  align-items center
  user-select none
  outline none

.slider__track
  width calc(100% - 32px)
  height 20px
  background linear-gradient(to bottom, transparent 0%, transparent 30%, #ddd 30%, #ddd 70%, transparent 70%, transparent 100%)
  position relative
  cursor pointer
  &::after
    content ''
    position absolute
    width calc(var(--progress) * 100%)
    height 100%
    left 0
    background linear-gradient(to bottom, transparent 0%, transparent 30%, #777 30%, #777 70%, transparent 70%, transparent 100%)

.slider__button
  position absolute
  cursor pointer
  left calc(8px + (var(--progress) * 112px))
  width 16px
  height 16px
  border-radius 100%
  background #888
  &:hover
    background #666

.spacer
  display none
  position absolute
  left 100%
  height 100%
  width $margin

.root:hover
.root.sliding
  .slider__anim-container
    width $slider-width
  .spacer
    display unset
</style>
