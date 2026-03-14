'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import ChatInterface from '@/components/chat/ChatInterface'
import LandingNav from '@/components/layout/LandingNav'
import { useT } from '@/lib/i18n/LanguageContext'

export default function PublicChatPage() {
  const t = useT()
  const [nudgeDismissed, setNudgeDismissed] = useState(false)

  return (
    <div className="flex flex-col h-screen">
      <LandingNav />

      {/* Sign-up nudge banner */}
      {!nudgeDismissed && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm">
          <span className="text-amber-800">
            {t('chat.nudge')}{' '}
            <Link href="/signup" className="font-semibold underline hover:no-underline text-amber-900">
              {t('nav.signup')}
            </Link>
          </span>
          <button
            onClick={() => setNudgeDismissed(true)}
            aria-label={t('chat.nudge.dismiss')}
            className="ml-4 text-amber-600 hover:text-amber-800 cursor-pointer p-1 rounded"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <ChatInterface />
      </div>
    </div>
  )
}
