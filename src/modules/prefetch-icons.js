export function prefetchIcons (icons) {
  for (const icon of icons) {
    const url = `/icons/${icon}.svg`
    const div = document.createElement('div')
    Object.assign(div.style, {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '50px',
      height: '50px',
      transform: 'translateX(-100%)',
      background: `url(${url})`
    })
    document.body.append(div)
  }
}
