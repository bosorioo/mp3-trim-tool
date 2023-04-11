import { createApp } from 'vue'
import App from './App.vue'
import { installDirectives } from './directives'

import './assets/main.styl'

const app = createApp(App)

installDirectives(app)

app.mount('#app')
