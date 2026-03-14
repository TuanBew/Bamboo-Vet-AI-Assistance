import Link from 'next/link'
import { cookies } from 'next/headers'
import { Pill, AlertTriangle, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import LandingNav from '@/components/layout/LandingNav'
import { translations } from '@/lib/i18n/translations'
import type { Language, TranslationKey } from '@/lib/i18n/translations'

const features = [
  { icon: Pill,          key: 'feature1' as const },
  { icon: AlertTriangle, key: 'feature2' as const },
  { icon: ClipboardList, key: 'feature3' as const },
]

export default async function LandingPage() {
  const cookieStore = await cookies()
  const lang = (cookieStore.get('lang')?.value ?? 'vi') as Language
  const t = (key: TranslationKey) => translations[lang][key]

  return (
    <div className="min-h-screen flex flex-col">
      <LandingNav />

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 bg-gradient-to-b from-teal-50 to-white">
        <span className="text-xs font-semibold tracking-widest text-teal-500 uppercase mb-4">
          {t('landing.badge')}
        </span>
        <h1 className="text-4xl md:text-5xl font-bold text-brand-darkText leading-tight mb-4">
          {t('landing.headline')}
        </h1>
        <p className="text-lg text-gray-600 mb-2 max-w-xl">
          {t('landing.subheadline')}
        </p>
        <p className="text-sm text-gray-400 mb-10 max-w-xl italic">
          {t('landing.subheadline.en')}
        </p>
        <Link href="/chat">
          <Button size="lg" className="bg-teal-500 hover:bg-teal-600 rounded-full px-8 text-base font-semibold cursor-pointer">
            {t('landing.cta')} →
          </Button>
        </Link>
      </main>

      {/* Features */}
      <section className="max-w-4xl mx-auto w-full px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map(({ icon: Icon, key }) => (
            <div key={key} className="text-center p-6 rounded-xl border border-teal-200 bg-white shadow-sm">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-teal-100 rounded-xl">
                  <Icon className="w-6 h-6 text-teal-600" aria-hidden="true" />
                </div>
              </div>
              <h3 className="font-semibold text-brand-darkText mb-1">
                {t(`landing.${key}.title`)}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t(`landing.${key}.desc`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="text-center py-6 text-xs text-muted-foreground border-t border-teal-100">
        © 2026 Bamboo Vet AI Assistance
      </footer>
    </div>
  )
}
