import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { initDB } from './services/db'

function initializeThemeSync() {
  const savedTheme = localStorage.getItem('emp-theme')
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

const startApp = async () => {
  initializeThemeSync()

  const isTauri = window.__TAURI_INTERNALS__ !== undefined;

  if (isTauri) {
    try {

      await initDB();
      console.log("DB initialized successfully.");
      

      const app = createApp(App)
      app.use(createPinia())
      app.use(router)
      app.mount('#app')

    } catch (error) {
    
      console.error("Critical System Failure:", error);
   
      const app = createApp(App)
      app.use(createPinia())
      app.use(router)
      app.mount('#app')
    }
  } else {
    const app = createApp(App)
    app.use(createPinia())
    app.use(router)
    app.mount('#app')
  }
}

startApp();