import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { convertFileSrc } from '@tauri-apps/api/core'
import { readFile, BaseDirectory } from '@tauri-apps/plugin-fs'


import { useSettingsStore } from './settings'

export const usePlayerStore = defineStore('player', () => {
  // --- STATE ---
  const currentSong = ref<any>(null)
  const isPlaying = ref(false)
  const isShuffle = ref(false)
  const repeatMode = ref(0) 
  
  const currentTime = ref(0)
  const duration = ref(0)
  
  const savedVolume = localStorage.getItem('emp-volume')
  const volume = ref(savedVolume ? parseFloat(savedVolume) : 0.3) 
  
  const coverUrl = ref<string | null>(null)

  const queue = ref<any[]>([])
  const currentIndex = ref(-1)

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
            
            if (repeatMode.value === 2) {
              playTrack(currentSong.value, queue.value) 
            } else {
              nextTrack()
            }
          }
        }
      }
    })

    audio.addEventListener('loadedmetadata', () => {
      if (activeEngine.value === engineName) {
        duration.value = audio.duration
      }
    })

    audio.addEventListener('ended', () => {

      if (activeEngine.value === engineName) {
        const settings = useSettingsStore()
        if (settings.crossfade === 0) {
          if (repeatMode.value === 2) playTrack(currentSong.value, queue.value)
          else nextTrack()
        }
      }
    })
  }


  setupAudioEvents(audioA, 'A')
  setupAudioEvents(audioB, 'B')

  // --- ACTIONS ---
  
  const loadCover = async (path: string | null) => {
    if (!path) {
      coverUrl.value = null
      return
    }
    try {
      const filename = path.split(/[\\/]/).pop();
      const relativePath = `covers/${filename}`;
      const contents = await readFile(relativePath, { baseDir: BaseDirectory.AppLocalData });
      const blob = new Blob([contents], { type: 'image/jpeg' });
      if (coverUrl.value) URL.revokeObjectURL(coverUrl.value);
      coverUrl.value = URL.createObjectURL(blob);
    } catch (err) {
      console.error("Gagal load cover untuk player:", err);
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

  // ==========================================
  // Crossfade Logic
  // ==========================================
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
      
      let newVol = newAudio.volume + volStep
      let oldVol = oldAudio.volume - volStep
      
      
      if (newVol > targetVol) newVol = targetVol
      if (oldVol < 0) oldVol = 0
      
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

 
  const playTrack = async (song: any, contextQueue: any[]) => {
    const settings = useSettingsStore()
    const cfDuration = settings.crossfade

    queue.value = contextQueue
    currentIndex.value = queue.value.findIndex(s => s.id === song.id)
    currentSong.value = song
    

    crossfadeStarted.value = false 
    
    await loadCover(song.cover_path)
    updateMediaSession()
    
    const playableUrl = convertFileSrc(song.path)
    

    const oldAudio = getActiveAudio()
    activeEngine.value = activeEngine.value === 'A' ? 'B' : 'A'
    const newAudio = getActiveAudio()

    newAudio.src = playableUrl

    try {

      if (cfDuration > 0 && !oldAudio.paused && oldAudio.currentTime > 0) {

        performCrossfade(oldAudio, newAudio, cfDuration, volume.value)
        isPlaying.value = true
      } else {
   
        oldAudio.pause()
        oldAudio.currentTime = 0
        
        newAudio.volume = volume.value
        await newAudio.play()
        isPlaying.value = true
      }
    } catch (err) {
      console.error("Gagal memutar audio:", err)
      isPlaying.value = false
    }
  }

  const togglePlay = () => {
    if (!currentSong.value) return
    const activeAudio = getActiveAudio()
    
    if (isPlaying.value) activeAudio.pause()
    else activeAudio.play()
    
    isPlaying.value = !isPlaying.value
  }

  const nextTrack = () => {
    if (queue.value.length === 0) return

    let nextIdx = currentIndex.value + 1
    if (isShuffle.value) {
       nextIdx = Math.floor(Math.random() * queue.value.length)
    } else if (nextIdx >= queue.value.length) {
       if (repeatMode.value === 1) nextIdx = 0
       else {
           isPlaying.value = false
           getActiveAudio().pause()
           getActiveAudio().currentTime = 0
           return
       }
    }
    playTrack(queue.value[nextIdx], queue.value)
  }

  const prevTrack = () => {
    if (queue.value.length === 0) return
    const activeAudio = getActiveAudio()
    
    if (activeAudio.currentTime > 3) {
      activeAudio.currentTime = 0
      return
    }
    
    let prevIdx = currentIndex.value - 1
    if (prevIdx < 0) {
      prevIdx = repeatMode.value === 1 ? queue.value.length - 1 : 0
    }
    playTrack(queue.value[prevIdx], queue.value)
  }

  const seek = (time: number) => {
    getActiveAudio().currentTime = time
  }

  const setVolume = (val: number) => {
    volume.value = val
    localStorage.setItem('emp-volume', val.toString())
    

    if (!fadeInterval) {
      getActiveAudio().volume = val
    }
  }

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
      getActiveAudio().play()
      isPlaying.value = true
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      getActiveAudio().pause()
      isPlaying.value = false
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
  }

  watch(isPlaying, (newVal) => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = newVal ? 'playing' : 'paused'
    }
  })

  return { 
    currentSong, isPlaying, isShuffle, repeatMode, 
    currentTime, duration, volume, coverUrl, queue,
    playTrack, togglePlay, nextTrack, prevTrack, seek, setVolume 
  }
})