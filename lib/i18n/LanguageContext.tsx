'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { translations, type Language, type TranslationKey } from './translations'

interface LanguageContextValue {
  lang: Language
  t: (key: TranslationKey) => string
  toggleLang: () => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({
  children,
  initialLang = 'vi',
}: {
  children: ReactNode
  initialLang?: Language
}) {
  const [lang, setLang] = useState<Language>(initialLang)

  const t = useCallback(
    (key: TranslationKey): string => translations[lang][key] ?? key,
    [lang]
  )

  const toggleLang = useCallback(() => {
    setLang(prev => {
      const next = prev === 'vi' ? 'en' : 'vi'
      document.cookie = `lang=${next};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`
      return next
    })
  }, [])

  return (
    <LanguageContext.Provider value={{ lang, t, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useT() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useT must be used within LanguageProvider')
  return ctx.t
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used within LanguageProvider')
  return { lang: ctx.lang, toggleLang: ctx.toggleLang }
}
