import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useWindowStore = defineStore('window', () => {
  const isMaximized = ref(false)
  return { isMaximized }
})