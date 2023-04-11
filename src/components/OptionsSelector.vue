<script setup>
const props = defineProps({
  open: Boolean,
  title: String,
  items: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'update:open',
  'item-click'
])

function onClickItem (item, index) {
  emit('item-click', item, index)
  emit('update:open', false)
}
</script>

<template lang="pug">
div(
  v-show="open"
  v-click-outside="() => emit('update:open', false)"
).options-selector.font-12
  div(v-show="title").title__container
    span {{ title }}
  div.column.no-wrap.items-stretch
    template(v-for="item, index in items")
      div(@click="onClickItem(item, index)").option__container
        slot(:item="item")
          span {{ item.title || item }}
</template>

<style lang="stylus" scoped>
.options-selector
  color white
  left 350px
  border solid 1px
  border-radius 8px
  padding 4px 0
  background rgba(0, 0, 0, 0.25)
  border-color rgba(255, 255, 255, 0.4)
  z-index 10000

.option__container
.title__container
  padding 4px 12px

.option__container
  cursor pointer
  &:hover
    background rgba(0, 0, 0, 0.25)
</style>
