<script setup>
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps({
  start: {
    type: Number,
    default: 0
  },
  end: {
    type: Number,
    default: Infinity
  },
  duration: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits([
  'update:start',
  'update:end'
])

const selectionIndex = ref(null)
const rootEl = ref(null)

function selectEl (el) {
  if (typeof el === 'number') {
    const timeId = [ 'mm', 'ss', 'ms' ][el % 3]
    const startEnd = el <= 2 ? 'start' : 'end'
    const selector = `[trim-${startEnd}][${timeId}]`
    const node = rootEl.value.querySelector(selector)
    if (node) {
      selectionIndex.value = el
      el = node
    }
  }
  if (!el) {
    return
  }
  if (window.getSelection && document.createRange) {
    const range = document.createRange()
    range.selectNodeContents(el)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  } else if (document.selection && document.body.createTextRange) {
    range = document.body.createTextRange()
    range.moveToElementText(el)
    range.select()
  }
}

function secondsToMMSSMS (seconds) {
  const ms = (seconds - Math.floor(seconds)) * 1e3
  const ss = Math.floor(seconds % 60)
  const mm = Math.floor(seconds / 60)
  return { ms, ss, mm }
}

function applyStep (type, delta) {
  if (type === 'start' && selectionIndex.value > 2) {
    selectionIndex.value = 2
  } else if (type === 'end' && selectionIndex.value <= 2) {
    selectionIndex.value = 5
  }
  let index = selectionIndex.value
  if (typeof index !== 'number' || Number.isNaN(index)) {
    index = (type === 'start' && 2) || (type === 'end' && 5)
  }
  const secondsDelta = [ 60, 1, 1e-2 ][index % 3] * delta
  const valueNow = index <= 2 ? props.start : props.end
  const valueLimitUpper = Math.min(props.duration, index <= 2 ? props.end : props.duration)
  const valueLimitLower = index <= 2 ? 0 : props.start
  const valueNext = Math.max(valueLimitLower, Math.min(valueNow + secondsDelta, valueLimitUpper))
  selectEl(index)
  emit(`update:${index <= 2 ? 'start' : 'end'}`, valueNext)
  nextTick().then(() => selectEl(selectionIndex.value))
}

function onMouseWheel (selIndex, event) {
  if (!event.ctrlKey && !event.shiftKey && !event.altKey && Math.abs(event.deltaY) > 0.1) {
    selectionIndex.value = selIndex
    applyStep(selIndex <= 2 ? 'start' : 'end', event.deltaY > 0 ? -1 : 1)
    event.preventDefault()
    event.stopPropagation()
  }
}

const timeLabels = computed(() => {
  const labelsStart = secondsToMMSSMS(Math.max(0, props.start))
  const labelsEnd = secondsToMMSSMS(Math.min(props.duration, props.end))
  return [
    [ labelsStart.mm, labelsStart.ss, Math.round(labelsStart.ms / 10) ],
    [ labelsEnd.mm, labelsEnd.ss, Math.round(labelsEnd.ms / 10) ]
  ]
    .map(row => row.map((s, index) => String(s).padStart(2, '0')))
})

watch(() => selectionIndex.value, (newValue) => {
  if (newValue !== null) {
    selectEl(newValue)
  }
})
</script>

<template lang="pug">
div(ref="rootEl").row.root.items-center
  div.column
    div.row.items-center
      span(
        trim-start
        mm
        @mousedown.left.prevent.stop="selectEl(0)"
        @wheel="onMouseWheel(0, $event)"
      ) {{ timeLabels[0][0] }}
      span :
      span(
        trim-start
        ss
        @mousedown.left.prevent.stop="selectEl(1)"
        @wheel="onMouseWheel(1, $event)"
      ) {{ timeLabels[0][1] }}
      span .
      span(
        trim-start
        ms
        @mousedown.left.prevent.stop="selectEl(2)"
        @wheel="onMouseWheel(2, $event)"
      ) {{ timeLabels[0][2] }}
      div.column.m-l-1
        div(@click.prevent.stop="applyStep('start', 1)").arrow-up__container
          div.arrow-up
        div(@click.prevent.stop="applyStep('start', -1)").arrow-down__container
          div.arrow-down
    span.font-12 Start

  div.column.m-l-3
    div.row.items-center
      span(
        trim-end
        mm
        @mousedown.left.prevent.stop="selectEl(3)"
        @wheel="onMouseWheel(3, $event)"
      ) {{ timeLabels[1][0] }}
      span :
      span(
        trim-end
        ss
        @mousedown.left.prevent.stop="selectEl(4)"
        @wheel="onMouseWheel(4, $event)"
      ) {{ timeLabels[1][1] }}
      span .
      span(
        trim-end
        ms
        @mousedown.left.prevent.stop="selectEl(5)"
        @wheel="onMouseWheel(5, $event)"
      ) {{ timeLabels[1][2] }}
      div.column.m-l-1
        div(@click.prevent.stop="applyStep('end', 1)").arrow-up__container
          div.arrow-up
        div(@click.prevent.stop="applyStep('end', -1)").arrow-down__container
          div.arrow-down
    span.font-12 End
</template>

<style lang="stylus" scoped>
.root
  color white
  font-weight 600
  font-size 15px

.arrow-up__container
.arrow-down__container
  padding 3px 5px
  cursor pointer
  &:hover
    > *
      border-bottom-color #ddd
      border-top-color #ddd

.arrow-up
  border-bottom solid 8px white
  border-left solid 4px transparent
  border-right solid 4px transparent

.arrow-down
  border-top solid 8px white
  border-left solid 4px transparent
  border-right solid 4px transparent
</style>
