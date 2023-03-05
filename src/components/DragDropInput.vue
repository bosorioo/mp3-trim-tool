<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'

const emit = defineEmits([
  'upload'
])

const isDragging = ref(false)
const dragEnterCounter = ref(0)

const props = defineProps({
  label: String,
  allowDrop: {
    type: Boolean,
    default: true
  },
  singleFile: {
    type: Boolean,
    default: false
  },
  extensions: String
})

const supportsDrop = computed(() => {
  return props.allowDrop && (
    'draggable' in document.body &&
    'ondrag' in document.body &&
    'FileReader' in window
  )
})

const uploadLabel = computed(() => {
  if (props.label) {
    return props.label
  }
  if (supportsDrop.value) {
    return props.singleFile
      ? '<b>Click to select a file</b> or drag it here'
      : '<b>Click to select files</b> or drag them here'
  }
  return props.singleFile
    ? '<b>Click to select a file</b>'
    : '<b>Click to select files</b>'
})

function onClickUploadArea (event) {
  const inputEl = event.target.querySelector('input')
  if (inputEl) {
    inputEl.value = null
    inputEl.click()
  }
}

function onFileUploaded (event) {
  emit('upload', event.target.files)
}

function onGlobalDragEvent (event) {
  if (event.dataTransfer && !event.dataTransfer.types.includes('Files')) {
    return
  }
  if (event.type === 'blur') {
    dragEnterCounter.value = 0
  } else if (event.type === 'drop') {
    console.log('drop', event)
  } else {
    const delta = (/enter|start/.test(event.type) && 1) ||
      (/leave|end/.test(event.type) && -1) ||
      0
    dragEnterCounter.value += delta
  }
}

function onDrop (event) {
  if (!supportsDrop.value) {
    return
  }
  if (event.dataTransfer && !event.dataTransfer.types.includes('Files')) {
    return
  }
  dragEnterCounter.value -= 1
  let files = Array.from(event.dataTransfer.files)
  if (props.extensions) {
    const extensions = props.extensions
      .split(',')
      .map(v => v.replace(/(^\.|\s+)/g, ''))
    const regex = new RegExp(`\.(${extensions.join('|')})$`, 'i')
    files = files.filter(f => regex.test(f.name))
  }
  if (files.length > 0) {
    onFileUploaded({ target: { files } })
  }
}

const dragEvents = [ 'dragenter', 'dragleave', 'dragstart', 'dragend', 'drop', 'drag' ]

onMounted(() => {
  if (supportsDrop.value) {
    window.addEventListener('blur', onGlobalDragEvent)
    window.addEventListener('drop', onGlobalDragEvent)
    for (const dragEvent of dragEvents) {
      document.addEventListener(dragEvent, onGlobalDragEvent)
    }
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('blur', onGlobalDragEvent)
  window.removeEventListener('drop', onGlobalDragEvent)
  for (const dragEvent of dragEvents) {
    document.removeEventListener(dragEvent, onGlobalDragEvent)
  }
})
</script>

<template lang="pug">
div(
  @click="onClickUploadArea"
  @drop.prevent.stop="onDrop"
  @dragover.prevent.stop
  :class="{ dragging: dragEnterCounter > 0, candrag: supportsDrop }"
).upload-area
  span(
    v-html="uploadLabel"
  ).upload-label
  div.drag-label Drop files here
  input(
    type="file"
    :accept="extensions"
    @input="onFileUploaded"
  )
</template>

<style lang="stylus" scoped>
input
  display none

.upload-area
  display flex
  align-items center
  justify-content center
  padding 32px 32px
  color #666
  border solid 1px #ccc
  border-radius 8px
  cursor pointer
  position relative
  background #f6f6f6
  .drag-label
    opacity 0
    position absolute
    top 0
    right 0
    left 0
    bottom 0
    display flex
    align-items center
    justify-content center
    font-weight 600
  &.candrag
    border-style dashed
  &.dragging
    background #ddd
    .upload-label
      opacity 0
    .drag-label
      opacity 1

  *
    pointer-events none
</style>
