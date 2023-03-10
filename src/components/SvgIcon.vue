<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  name: String,
  size: {
    type: Number,
    default: 16
  }
})

const rootEl = ref(null)

const computedStyle = computed(() => {
  const url = `url('${import.meta.env.BASE_URL}icons/${props.name}.svg')`
  return {
    width: props.size + 'px',
    height: props.size + 'px',
    backgroundColor: 'currentColor',
    maskImage: url,
    '-webkit-mask-image': url
  }
})
</script>

<template lang="pug">
div(ref="rootEl" :style="computedStyle").svg-icon
</template>

<style lang="stylus" scoped>
.svg-icon
  fill currentColor
</style>
