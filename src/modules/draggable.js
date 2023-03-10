import { watch, onBeforeUnmount } from 'vue'

export function useDraggableEl (elRef, options = {}) {
  const {
    clickTriggerDistance = 3,
    buttonWhich = 1,
    onDrag,
    onDragStart,
    onDragStop,
    onClick
  } = options

  let dragStartX
  let dragStartY
  let isWithinClickDistance

  const onEvent = (event) => {
    if (event.which !== buttonWhich) {
      return
    }
    if (event.type === 'mousemove') {
      const x = event.clientX
      const y = event.clientY
      const dragDistanceX = Math.abs(x - dragStartX)
      const dragDistanceY = Math.abs(y - dragStartY)
      const dragDistance = Math.sqrt(dragDistanceX * dragDistanceX + dragDistanceY * dragDistanceY)
      if (dragDistance >= clickTriggerDistance) {
        isWithinClickDistance = false
      }
      if (typeof onDrag === 'function') {
        onDrag({
          x,
          y,
          dragDistance,
          dragDistanceX,
          dragDistanceY,
          dragStartX,
          dragStartY
        })
      }
    } else if (event.type === 'mousedown') {
      dragStartX = event.clientX
      dragStartY = event.clientY
      isWithinClickDistance = true
      window.addEventListener('mouseup', onEvent, { capture: true })
      window.addEventListener('mousemove', onEvent, { capture: true })
      window.addEventListener('blur', onEvent)
      if (typeof onDragStart === 'function') {
        onDragStart({ dragStartX, dragStartY })
      }
    } else if (event.type === 'mouseup') {
      if (typeof onDragStop === 'function') {
        onDragStop({ x: event.clientX, y: event.clientY })
      }
      if (isWithinClickDistance && typeof onClick === 'function') {
        onClick()
      }
      cleanup()
    } else if (event.type === 'blur') {
      if (typeof onDragStop === 'function') {
        onDragStop({})
      }
      cleanup()
    }
  }

  const cleanup = (el) => {
    if (el) {
      el.removeEventListener('mousedown', onEvent)
    }
    window.removeEventListener('mouseup', onEvent, { capture: true })
    window.removeEventListener('mousemove', onEvent, { capture: true })
    window.removeEventListener('blur', onEvent)
  }

  watch(elRef, (newValue, oldValue) => {
    if (oldValue) {
      cleanup(oldValue)
    }
    if (newValue) {
      newValue.addEventListener('mousedown', onEvent)
    }
  })

  onBeforeUnmount(() => cleanup(elRef.value))
}
