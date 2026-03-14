import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import { LanguageProvider } from '@/lib/i18n/LanguageContext'
import type { Language } from '@/lib/i18n/translations'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Bamboo Vet AI Assistance',
  description: 'Trợ lý AI cho bác sĩ thú y — Drug lookup, dosages & treatment guidance',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const lang = (cookieStore.get('lang')?.value ?? 'vi') as Language

  return (
    <html lang={lang} className={inter.variable}>
      <body className="font-sans antialiased">
        <LanguageProvider initialLang={lang}>
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}
