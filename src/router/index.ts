import { createRouter, createWebHistory } from 'vue-router'
import LibraryView from '../views/LibraryView.vue' //

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
      path: '/album/:name', // :name adalah parameter dinamis
      name: 'album',
      component: () => import('../views/AlbumView.vue')
    },


  ],
})

export default router