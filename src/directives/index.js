import { float } from './directive-float.js'
import { clickOutside } from './directive-click-outside.js'

const directives = {
  float,
  clickOutside
}

export function installDirectives (app) {
  for (const name in directives) {
    app.directive(name, directives[name])
  }
}
