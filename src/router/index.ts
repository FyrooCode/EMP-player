import { createRouter, createWebHistory } from 'vue-router'
import LibraryView from '../views/LibraryView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'library',
      component: LibraryView 
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue')
    },
    {
      path: '/album/:name',
      name: 'album',
      component: () => import('../views/AlbumView.vue')
    },
    // TAMBAHKAN RUTE LYRICS DI SINI
    {
      path: '/lyrics',
      name: 'lyrics',
      component: () => import('../views/LyricsView.vue')
    },
  ],
})

export default router