import { cookies } from 'next/headers'
import { Plus } from 'lucide-react'
import { translations } from '@/lib/i18n/translations'
import type { Language, TranslationKey } from '@/lib/i18n/translations'

export default async function AppPage() {
  const cookieStore = await cookies()
  const lang = (cookieStore.get('lang')?.value ?? 'vi') as Language
  const t = (key: TranslationKey) => translations[lang][key]

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div className="mb-6 p-4 bg-teal-100 rounded-2xl">
        <Plus className="w-8 h-8 text-teal-600" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-semibold text-brand-darkText mb-2">
        {t('chat.emptyState')}
      </h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        {t('chat.newChat')}
      </p>
    </div>
  )
}
