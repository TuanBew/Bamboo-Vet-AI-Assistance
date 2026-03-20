'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ArrowLeft, MessageSquare } from 'lucide-react'

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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function UserHistoryDrawer({
  open,
  onOpenChange,
  userName,
  conversations,
  selectedConversation,
  messages,
  onSelectConversation,
}: UserHistoryDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[400px] sm:max-w-[400px] bg-gray-900 text-white border-gray-700 flex flex-col"
      >
        <SheetHeader>
          <SheetTitle className="text-white">
            Lich su — {userName}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col mt-4">
          {selectedConversation ? (
            // Message thread view
            <div className="flex flex-col h-full">
              {/* Header with back button */}
              <div className="flex items-center gap-2 pb-3 border-b border-gray-700 px-1">
                <button
                  onClick={() => onSelectConversation?.(undefined as unknown as Conversation)}
                  className="text-gray-400 hover:text-white p-1"
                  title="Quay lai"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-gray-200 truncate">
                  {selectedConversation.title.length > 50
                    ? selectedConversation.title.substring(0, 50) + '...'
                    : selectedConversation.title}
                </span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto py-3 space-y-3 px-1">
                {messages.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center mt-8">
                    Dang tai tin nhan...
                  </p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={
                          m.role === 'user'
                            ? 'bg-teal-600 text-white rounded-lg px-3 py-2 max-w-[85%] ml-auto'
                            : 'bg-gray-700 text-white rounded-lg px-3 py-2 max-w-[85%]'
                        }
                      >
                        <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            // Conversation list view
            <div className="flex-1 overflow-y-auto px-1">
              {conversations.length === 0 ? (
                <p className="text-sm text-gray-500 text-center mt-8">
                  Chua co lich su tro chuyen
                </p>
              ) : (
                <div className="space-y-1">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => onSelectConversation?.(conv)}
                      className="w-full text-left px-3 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200 truncate">
                            {conv.title.length > 50
                              ? conv.title.substring(0, 50) + '...'
                              : conv.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDate(conv.created_at)}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                          <MessageSquare className="w-3 h-3" />
                          {conv.message_count}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
