import { useEffect, useState } from 'react'

export type AppTheme = 'light' | 'dark'

const STORAGE_KEY = 'hj.theme'
const listeners = new Set<(theme: AppTheme) => void>()

function detectInitialTheme(): AppTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // 隐私模式：跟随系统
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

let current: AppTheme = detectInitialTheme()

function applyToDocument(theme: AppTheme): void {
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
}

/** 在 React 挂载前调用一次，避免首屏闪白/闪黑 */
export function bootstrapTheme(): void {
  applyToDocument(current)
}

export function getTheme(): AppTheme {
  return current
}

export function setTheme(theme: AppTheme): void {
  current = theme
  applyToDocument(theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // 忽略写入失败
  }
  listeners.forEach((listener) => listener(theme))
}

export function toggleTheme(): void {
  setTheme(current === 'dark' ? 'light' : 'dark')
}

export function useAppTheme(): [AppTheme, () => void] {
  const [theme, setLocalTheme] = useState<AppTheme>(current)

  useEffect(() => {
    const listener = (next: AppTheme) => setLocalTheme(next)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  return [theme, toggleTheme]
}
