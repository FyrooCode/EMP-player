import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'loading';
  message: string;
  autoClose?: boolean;
}

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])

  const show = (type: Toast['type'], message: string, autoClose = true) => {
    const id = Math.random().toString(36).substring(2, 9)
    toasts.value.push({ id, type, message, autoClose })
    
    if (autoClose && type !== 'loading') {
      setTimeout(() => remove(id), 5000) // Diubah ke 5 detik agar tidak terlalu lama
    }
    return id
  }

  const remove = (id: string) => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  const updateStatus = (id: string, type: 'success' | 'error', newMessage: string) => {
    const toast = toasts.value.find(t => t.id === id)
    if (toast) {
      toast.type = type
      toast.message = newMessage
      setTimeout(() => remove(id), 3000)
    }
  }

  return { toasts, show, remove, updateStatus }
})