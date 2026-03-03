import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { convertFileSrc } from '@tauri-apps/api/core'
import { readFile, BaseDirectory } from '@tauri-apps/plugin-fs'
import { listen } from '@tauri-apps/api/event'

import { useSettingsStore } from './settings'

export const usePlayerStore = defineStore('player', () => {
  // --- STATE ---
  const currentSong = ref<any>(null)
  const isPlaying = ref(false)
  const isShuffle = ref(false)
  const repeatMode = ref(0) // 0: Off, 1: All, 2: One
  
  const currentTime = ref(0)
  const duration = ref(0)
  
  const savedVolume = localStorage.getItem('emp-volume')
  const volume = ref(savedVolume ? parseFloat(savedVolume) : 0.3) 
  
  const coverUrl = ref<string | null>(null)
  const queue = ref<any[]>([])
  const currentIndex = ref(-1)
  const parsedLyrics = ref<{ time: number; text: string }[]>([])

  // ==========================================
  // DUAL-ENGINE AUDIO (DECK A & DECK B)
  // ==========================================
  const audioA = new Audio()
  const audioB = new Audio()
  
  audioA.volume = volume.value
  audioB.volume = volume.value

  const activeEngine = ref<'A' | 'B'>('A')
  const crossfadeStarted = ref(false) 
  let fadeInterval: number | null = null

  const getActiveAudio = () => activeEngine.value === 'A' ? audioA : audioB
  const getInactiveAudio = () => activeEngine.value === 'A' ? audioB : audioA

  // --- LOGIC PARSING LIRIK ---
  const parseLyrics = (rawLyrics: string) => {
    if (!rawLyrics) {
      parsedLyrics.value = []
      return
    }
    const lines = rawLyrics.split('\n')
    const lyricPattern = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/
    const result = lines.map(line => {
      const match = lyricPattern.exec(line)
      if (match) {
        const minutes = parseInt(match[1])
        const seconds = parseInt(match[2])
        const ms = parseInt(match[3])
        const time = minutes * 60 + seconds + (ms > 99 ? ms / 1000 : ms / 100)
        return { time, text: match[4].trim() }
      }
      return null
    }).filter(item => item !== null && item.text !== "") as { time: number; text: string }[]
    parsedLyrics.value = result
  }

  const setupAudioEvents = (audio: HTMLAudioElement, engineName: 'A' | 'B') => {
    audio.addEventListener('timeupdate', () => {
      if (activeEngine.value === engineName) {
        currentTime.value = audio.currentTime
        const settings = useSettingsStore()
        const cfDuration = settings.crossfade
        
        if (cfDuration > 0 && audio.duration > 0 && !audio.paused) {
          const timeLeft = audio.duration - audio.currentTime
          if (timeLeft <= cfDuration && !crossfadeStarted.value) {
            crossfadeStarted.value = true 
            if (repeatMode.value === 2) playTrack(currentSong.value, queue.value, true) 
            else nextTrack(true)
          }
        }
      }
    })

    audio.addEventListener('loadedmetadata', () => {
      if (activeEngine.value === engineName) duration.value = audio.duration
    })

    audio.addEventListener('ended', () => {
      if (activeEngine.value === engineName) {
        const settings = useSettingsStore()
        if (settings.crossfade === 0) {
          if (repeatMode.value === 2) playTrack(currentSong.value, queue.value, false)
          else nextTrack(false)
        }
      }
    })
  }

  setupAudioEvents(audioA, 'A')
  setupAudioEvents(audioB, 'B')

  // --- ACTIONS ---
  const loadCover = async (path: string | null) => {
    if (!path) { coverUrl.value = null; return; }
    try {
      const filename = path.split(/[\\/]/).pop();
      const relativePath = `covers/${filename}`;
      const contents = await readFile(relativePath, { baseDir: BaseDirectory.AppLocalData });
      const blob = new Blob([contents], { type: 'image/jpeg' });
      if (coverUrl.value) URL.revokeObjectURL(coverUrl.value);
      coverUrl.value = URL.createObjectURL(blob);
    } catch (err) {
      coverUrl.value = null
    }
  }

  const updateMediaSession = () => {
    if ('mediaSession' in navigator && currentSong.value) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.value.title || 'Unknown Title',
        artist: currentSong.value.artist || 'Unknown Artist',
        album: currentSong.value.album || 'Unknown Album',
        artwork: coverUrl.value ? [{ src: coverUrl.value, sizes: '512x512', type: 'image/jpeg' }] : []
      })
    }
  }

  const performCrossfade = (oldAudio: HTMLAudioElement, newAudio: HTMLAudioElement, durationSec: number, targetVol: number) => {
    if (fadeInterval) clearInterval(fadeInterval)
    const steps = 20 * durationSec 
    const intervalTime = 50 
    const volStep = targetVol / steps 
    
    newAudio.volume = 0
    oldAudio.volume = targetVol
    newAudio.play().catch(e => console.error(e))

    let currentStep = 0
    fadeInterval = window.setInterval(() => {
      currentStep++
      let newVol = Math.min(newAudio.volume + volStep, targetVol)
      let oldVol = Math.max(oldAudio.volume - volStep, 0)
      
      newAudio.volume = newVol
      oldAudio.volume = oldVol

      if (currentStep >= steps) {
        clearInterval(fadeInterval!)
        fadeInterval = null
        oldAudio.pause()
        oldAudio.currentTime = 0
        newAudio.volume = targetVol
      }
    }, intervalTime)
  }

  const playTrack = async (song: any, contextQueue: any[], useCrossfade: boolean = false) => {
    // Stop any ongoing crossfade immediately when starting a new track
    if (fadeInterval) {
      clearInterval(fadeInterval)
      fadeInterval = null
    }

    const settings = useSettingsStore()
    queue.value = contextQueue
    currentIndex.value = queue.value.findIndex(s => s.id === song.id)
    currentSong.value = song
    
    parseLyrics(song.lyrics || "") 
    crossfadeStarted.value = false 
    
    await loadCover(song.cover_path)
    
    const playableUrl = convertFileSrc(song.path)
    const oldAudio = getActiveAudio()
    activeEngine.value = activeEngine.value === 'A' ? 'B' : 'A'
    const newAudio = getActiveAudio()

    newAudio.src = playableUrl

    try {
      if (useCrossfade && settings.crossfade > 0 && !oldAudio.paused && oldAudio.currentTime > 0) {
        performCrossfade(oldAudio, newAudio, settings.crossfade, volume.value)
      } else {
        oldAudio.pause()
        oldAudio.currentTime = 0
        newAudio.volume = volume.value
        await newAudio.play()
      }
      isPlaying.value = true
      updateMediaSession()
    } catch (err) {
      isPlaying.value = false
    }
  }

  const togglePlay = () => {
    if (!currentSong.value) return
    const activeAudio = getActiveAudio()
    if (isPlaying.value) activeAudio.pause()
    else activeAudio.play().catch(e => console.error(e))
    isPlaying.value = !isPlaying.value
  }

  const nextTrack = (useCrossfade: boolean = false) => {
    if (queue.value.length === 0) return
    let nextIdx = currentIndex.value + 1
    if (isShuffle.value) {
       nextIdx = Math.floor(Math.random() * queue.value.length)
    } else if (nextIdx >= queue.value.length) {
       if (repeatMode.value === 1) nextIdx = 0
       else {
           isPlaying.value = false; getActiveAudio().pause(); getActiveAudio().currentTime = 0;
           return
       }
    }
    // Perbaikan: Navigasi manual (tombol) tidak pakai crossfade demi responsivitas
    playTrack(queue.value[nextIdx], queue.value, useCrossfade)
  }

  const prevTrack = () => {
    if (queue.value.length === 0) return
    const activeAudio = getActiveAudio()
    if (activeAudio.currentTime > 3) {
      activeAudio.currentTime = 0
      return
    }
    let prevIdx = currentIndex.value - 1
    if (prevIdx < 0) prevIdx = repeatMode.value === 1 ? queue.value.length - 1 : 0
    playTrack(queue.value[prevIdx], queue.value, false)
  }

  const seek = (time: number) => { getActiveAudio().currentTime = time }
  
  const setVolume = (val: number) => {
    volume.value = val
    localStorage.setItem('emp-volume', val.toString())
    if (!fadeInterval) {
      audioA.volume = val
      audioB.volume = val
    }
  }

  // --- SHORTCUT LISTENERS ---
  listen('media-toggle', () => togglePlay())
  listen('media-next', () => nextTrack(false)) // Manual next: no crossfade
  listen('media-prev', () => prevTrack())

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => togglePlay())
    navigator.mediaSession.setActionHandler('pause', () => togglePlay())
    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack())
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack(false))
  }

  watch(isPlaying, (newVal) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = newVal ? 'playing' : 'paused'
    }
  })

  return { 
    currentSong, isPlaying, isShuffle, repeatMode, 
    currentTime, duration, volume, coverUrl, queue,
    parsedLyrics, parseLyrics,
    playTrack, togglePlay, nextTrack, prevTrack, seek, setVolume 
  }
})