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

  // PERBAIKAN: Lakukan casting ke 'any' agar properti __TAURI_INTERNALS__ tidak menyebabkan error build
  const isTauri = (window as any).__TAURI_INTERNALS__ !== undefined;

  if (isTauri) {
    try {
      // Tunggu database sampai benar-benar siap sebelum membuat app
      await initDB();
      console.log("DB initialized successfully.");
      
      const app = createApp(App)
      app.use(createPinia())
      app.use(router)
      app.mount('#app')

    } catch (error) {
      console.error("Critical System Failure - Database initialization failed:", error);
      // Tampilkan pesan eror ke layar atau jangan render app sama sekali
      document.body.innerHTML = `<div style="color:white; background:#070709; height:100vh; display:flex; align-items:center; justify-content:center; font-family:sans-serif; text-align:center;">
        <div>
          <h1 style="color:#ef4444">DATABASE ERROR</h1>
          <p>Migration mismatch detected. Please delete old .db files in AppData.</p>
          <pre style="font-size:10px; opacity:0.5">${error}</pre>
        </div>
      </div>`;
    }
  } else {
    const app = createApp(App)
    app.use(createPinia())
    app.use(router)
    app.mount('#app')
  }
}

startApp();