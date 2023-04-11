const EVENTS = [ 'mousedown', 'touchstart' ]
const EVENT_OPTIONS = { capture: true }

function isElChildOf (el, parentEl) {
  while (el) {
    if (el === parentEl) {
      return true
    }
    el = el.parentElement
  }
  return false
}

function cleanupEl (el) {
  if (el.__clickOutsideHandler) {
    EVENTS.forEach(event => window.removeEventListener(event, el.__clickOutsideHandler, EVENT_OPTIONS))
  }
}

function registerElCallback (el, callback) {
  cleanupEl(el)
  el.__clickOutsideHandler = (event) => {
    const within = isElChildOf(event.target || event.srcElement, el)
    if (!within && typeof callback === 'function') {
      callback()
    }
  }
  EVENTS.forEach(event => window.addEventListener(event, el.__clickOutsideHandler, EVENT_OPTIONS))
}

export const clickOutside = {

  created (el, binding) {
    registerElCallback(el, binding.value)
  },

  unmounted (el) {
    cleanupEl(el)
  }

}
