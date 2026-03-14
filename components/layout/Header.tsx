'use client'

import { LogOut } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { useT, useLang } from '@/lib/i18n/LanguageContext'
import { createClient } from '@/lib/supabase/client'

export default function Header() {
  const t = useT()
  const { toggleLang } = useLang()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <header className="h-12 border-b border-teal-200 bg-white flex items-center justify-between px-3 flex-shrink-0">
      <SidebarTrigger className="text-gray-500 hover:text-teal-600 cursor-pointer" />
      <div className="flex items-center gap-2">
        <button
          onClick={toggleLang}
          className="text-xs text-muted-foreground hover:text-teal-600 transition-colors cursor-pointer font-medium"
          aria-label="Toggle language"
        >
          {t('nav.lang')}
        </button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          aria-label={t('nav.logout')}
          className="cursor-pointer hover:bg-teal-50 h-8 w-8"
        >
          <LogOut className="w-4 h-4 text-gray-500" aria-hidden="true" />
        </Button>
      </div>
    </header>
  )
}
