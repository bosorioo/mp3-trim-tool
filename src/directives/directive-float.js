function getTargetEl (srcEl, target = 'parentElement') {
  if (typeof target === 'function') {
    target = target()
  }
  if (typeof target === 'string') {
    if (target in srcEl) {
      target = srcEl[target]
    } else {
      target = document.querySelector(target)
    }
  }
  if (target && 'getBoundingClientRect' in target) {
    return target
  }
}

function parseAnchorValue (anchorValue, srcValue = 1) {
  const multiplier = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 1,
    center: 0.5
  }[anchorValue] || 0
  return srcValue * multiplier
}

function applyFloat (el, binding) {
  const { value } = binding
  let {
    target = el && el.parentElement,
    anchor = [ 'center right', 'center left' ],
    offset = 8,
    zIndex = 200
  } = value

  const targetEl = getTargetEl(el, target)

  if (targetEl) {
    const elRect = el.getBoundingClientRect()
    const targetRect = targetEl.getBoundingClientRect()
    const anchorFrom = anchor[0].split(' ')
    const anchorTo = anchor[1].split(' ')
    const anchorFromYFactor = parseAnchorValue(anchorFrom[0])
    const anchorFromXFactor = parseAnchorValue(anchorFrom[1])
    const anchorFromY = targetRect.y + anchorFromYFactor * targetRect.height
    const anchorFromX = targetRect.x + anchorFromXFactor * targetRect.width
    const anchorToYFactor = parseAnchorValue(anchorTo[0])
    const anchorToXFactor = parseAnchorValue(anchorTo[1])
    const anchorToY = elRect.height * anchorToYFactor
    const anchorToX = elRect.width * anchorToXFactor
    const offsetX = offset * 2 * (anchorFromXFactor - 0.5)
    const offsetY = offset * 2 * (anchorFromYFactor - 0.5)
    const left = anchorFromX + offsetX - anchorToX
    const top = anchorFromY + offsetY - anchorToY
    Object.assign(el.style, {
      visibility: '',
      zIndex,
      left: `${left}px`,
      top: `${top}px`
    })
  }
}

export const float = {

  created (el) {
    Object.assign(el.style, { position: 'fixed', visibility: 'hidden' })
  },

  mounted (el, binding, vnode, prevVnode) {
    applyFloat(el, binding)
  },

  updated (el, binding, vnode, prevVnode) {
    applyFloat(el, binding)
  }

}
