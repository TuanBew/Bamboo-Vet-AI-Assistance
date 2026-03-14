'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Plus } from 'lucide-react'
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarGroup, SidebarGroupLabel,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import ConversationItem from './ConversationItem'
import { useT } from '@/lib/i18n/LanguageContext'
import type { TranslationKey } from '@/lib/i18n/translations'

interface Conversation {
  id: string
  title: string
  updated_at: string
}

interface Props {
  conversations: Conversation[]
}

function groupByDate(convs: Conversation[]) {
  const now = new Date()
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)

  const groups: Record<'today' | 'yesterday' | 'older', Conversation[]> = {
    today: [], yesterday: [], older: [],
  }

  for (const c of convs) {
    const d = new Date(c.updated_at)
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    if (day >= today)          groups.today.push(c)
    else if (day >= yesterday) groups.yesterday.push(c)
    else                       groups.older.push(c)
  }

  return groups
}

export default function AppSidebar({ conversations }: Props) {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  // Derive active conversation from URL — no prop needed from layout
  const activeId = pathname.startsWith('/app/conversation/')
    ? pathname.split('/').pop()
    : undefined

  async function handleNewChat() {
    const res = await fetch('/api/conversations', { method: 'POST' })
    if (!res.ok) { console.error('Failed to create conversation'); return }
    const { id } = await res.json()
    router.push(`/app/conversation/${id}`)
    router.refresh()
  }

  const groups = groupByDate(conversations)

  return (
    <Sidebar className="border-r border-teal-200 bg-teal-50">
      <SidebarHeader className="p-3 border-b border-teal-200">
        <div className="text-lg font-bold text-teal-700 mb-2">Bamboo Vet</div>
        <Button
          onClick={handleNewChat}
          className="w-full bg-teal-500 hover:bg-teal-600 text-white cursor-pointer"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
          {t('nav.newChat')}
        </Button>
      </SidebarHeader>

      <SidebarContent className="py-2">
        {(['today', 'yesterday', 'older'] as const).map(period => {
          const items = groups[period]
          if (items.length === 0) return null
          return (
            <SidebarGroup key={period}>
              <SidebarGroupLabel className="text-xs text-muted-foreground px-3 py-1">
                {t(`sidebar.${period}` as TranslationKey)}
              </SidebarGroupLabel>
              <div className="px-2 space-y-0.5">
                {items.map(c => (
                  <ConversationItem
                    key={c.id}
                    id={c.id}
                    title={c.title}
                    active={c.id === activeId}
                  />
                ))}
              </div>
            </SidebarGroup>
          )
        })}
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-8 px-4">
            {t('chat.emptyState')}
          </p>
        )}
      </SidebarContent>
    </Sidebar>
  )
}
