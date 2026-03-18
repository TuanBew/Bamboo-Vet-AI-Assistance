'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export interface Conversation {
  id: string
  title: string
  created_at: string
  message_count: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface UserHistoryDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userName: string
  userId: string
  conversations: Conversation[]
  selectedConversation?: Conversation
  messages: Message[]
  onSelectConversation?: (conv: Conversation) => void
}

export function UserHistoryDrawer({
  open,
  onOpenChange,
  userName,
  conversations,
  messages,
}: UserHistoryDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[400px] sm:max-w-[400px] bg-gray-900 text-white border-gray-700"
      >
        <SheetHeader>
          <SheetTitle className="text-white">
            Lich su — {userName}
          </SheetTitle>
        </SheetHeader>
        <div className="p-4">
          <p className="text-sm text-gray-400">
            {conversations.length} conversations, {messages.length} messages
            loaded
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Conversation list + chat view — wired in Phase 5
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
