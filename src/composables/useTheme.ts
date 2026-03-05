import { onMounted, onUnmounted, ref, watch } from 'vue'

export type ThemePreference = 'system' | 'light' | 'dark'
export type LightThemeVariant = 'clean' | 'paper' | 'sand' | 'mint'
export type DarkThemeVariant = 'slate' | 'midnight' | 'graphite' | 'forest'
export type AccentColor = 'blue' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet'

const THEME_STORAGE_KEY = 'requestmaker-theme'
const LIGHT_THEME_STORAGE_KEY = 'requestmaker-light-theme'
const DARK_THEME_STORAGE_KEY = 'requestmaker-dark-theme'
const ACCENT_STORAGE_KEY = 'requestmaker-accent'

export function useTheme() {
  const themePreference = ref<ThemePreference>('system')
  const lightThemeVariant = ref<LightThemeVariant>('clean')
  const darkThemeVariant = ref<DarkThemeVariant>('slate')
  const accentColor = ref<AccentColor>('blue')
  let mediaQuery: MediaQueryList | null = null
  let stopWatcher: (() => void) | null = null

  function applyThemeTokens() {
    if (typeof window === 'undefined') {
      return
    }

    document.documentElement.dataset.lightTheme = lightThemeVariant.value
    document.documentElement.dataset.darkTheme = darkThemeVariant.value
    document.documentElement.dataset.accent = accentColor.value
  }

  function applyTheme(preference: ThemePreference) {
    if (typeof window === 'undefined') {
      return
    }

    const systemPrefersDark = mediaQuery?.matches ?? window.matchMedia('(prefers-color-scheme: dark)').matches
    const enableDark = preference === 'dark' || (preference === 'system' && systemPrefersDark)
    document.documentElement.classList.toggle('dark', enableDark)
    applyThemeTokens()
  }

  function setTheme(preference: ThemePreference) {
    themePreference.value = preference
  }

  function setLightThemeVariant(variant: LightThemeVariant) {
    lightThemeVariant.value = variant
  }

  function setDarkThemeVariant(variant: DarkThemeVariant) {
    darkThemeVariant.value = variant
  }

  function setAccentColor(accent: AccentColor) {
    accentColor.value = accent
  }

  function handleSystemThemeChange() {
    if (themePreference.value === 'system') {
      applyTheme('system')
    }
  }

  onMounted(() => {
    if (typeof window === 'undefined') {
      return
    }

    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      themePreference.value = stored
    }

    const storedLightTheme = window.localStorage.getItem(LIGHT_THEME_STORAGE_KEY)
    if (storedLightTheme === 'clean' || storedLightTheme === 'paper' || storedLightTheme === 'sand' || storedLightTheme === 'mint') {
      lightThemeVariant.value = storedLightTheme
    }

    const storedDarkTheme = window.localStorage.getItem(DARK_THEME_STORAGE_KEY)
    if (storedDarkTheme === 'slate' || storedDarkTheme === 'midnight' || storedDarkTheme === 'graphite' || storedDarkTheme === 'forest') {
      darkThemeVariant.value = storedDarkTheme
    }

    const storedAccent = window.localStorage.getItem(ACCENT_STORAGE_KEY)
    if (
      storedAccent === 'blue' ||
      storedAccent === 'cyan' ||
      storedAccent === 'emerald' ||
      storedAccent === 'amber' ||
      storedAccent === 'rose' ||
      storedAccent === 'violet'
    ) {
      accentColor.value = storedAccent
    }

    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', handleSystemThemeChange)

    stopWatcher = watch(
      [() => themePreference.value, () => lightThemeVariant.value, () => darkThemeVariant.value, () => accentColor.value],
      ([preference, lightVariant, darkVariant, accent]) => {
        window.localStorage.setItem(THEME_STORAGE_KEY, preference)
        window.localStorage.setItem(LIGHT_THEME_STORAGE_KEY, lightVariant)
        window.localStorage.setItem(DARK_THEME_STORAGE_KEY, darkVariant)
        window.localStorage.setItem(ACCENT_STORAGE_KEY, accent)
        applyTheme(preference)
      },
      { immediate: true },
    )
  })

  onUnmounted(() => {
    mediaQuery?.removeEventListener('change', handleSystemThemeChange)
    stopWatcher?.()
  })

  return {
    themePreference,
    lightThemeVariant,
    darkThemeVariant,
    accentColor,
    setTheme,
    setLightThemeVariant,
    setDarkThemeVariant,
    setAccentColor,
  }
}
