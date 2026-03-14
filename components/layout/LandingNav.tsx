'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useT, useLang } from '@/lib/i18n/LanguageContext'

export default function LandingNav() {
  const t = useT()
  const { lang, toggleLang } = useLang()

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-teal-200">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-teal-600">{t('nav.brand')}</Link>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleLang}
            className="text-sm text-muted-foreground hover:text-teal-600 transition-colors cursor-pointer font-medium"
            aria-label="Toggle language"
          >
            {t('nav.lang')}
          </button>
          <Link href="/login">
            <Button variant="ghost" size="sm" className="text-teal-700 hover:bg-teal-50 cursor-pointer">
              {t('nav.login')}
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm" className="bg-teal-500 hover:bg-teal-600 cursor-pointer">
              {t('nav.signup')}
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  )
}
