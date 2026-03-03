import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getDB } from '../services/db'

export const useSearchStore = defineStore('search', () => {
  const searchQuery = ref('')
  const searchResults = ref<any[]>([])
  const isSearching = ref(false)

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      searchResults.value = []
      return
    }

    isSearching.value = true
    const db = getDB()
    
    try {
      // Mencari berdasarkan judul, artist, atau album
      const sql = `
        SELECT * FROM songs 
        WHERE title LIKE $1 
        OR artist LIKE $2 
        OR album LIKE $3 
        LIMIT 50
      `
      const pattern = `%${query}%`
      const results = await db.select<any[]>(sql, [pattern, pattern, pattern])
      searchResults.value = results
    } catch (err) {
      console.error("Search Error:", err)
    } finally {
      isSearching.value = false
    }
  }

  return { searchQuery, searchResults, isSearching, performSearch }
})