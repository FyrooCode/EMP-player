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
      path: '/collections',
      name: 'collections',
      component: () => import('../views/CollectionsView.vue')
    },
    {
      path: '/collection/all-songs',
      name: 'all-songs',
      component: () => import('../views/AllSongsView.vue')
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
    {
      path: '/lyrics',
      name: 'lyrics',
      component: () => import('../views/LyricsView.vue')
    },

    {
      path: '/search',
      name: 'search',
      component: () => import('../views/SearchView.vue')
    },
  ],
})

export default router