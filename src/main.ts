import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import './assets/index.css'

if (
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  !window.requestmakerElectron?.isElectron
) {
  void import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({ immediate: true })
    })
    .catch(() => undefined)
}

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
