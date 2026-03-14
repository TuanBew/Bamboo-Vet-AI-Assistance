import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  interrupted?: boolean
}

interface Props {
  message: ChatMessage
  streamInterruptedLabel?: string
}

export default function MessageBubble({ message, streamInterruptedLabel }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[70%] px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-teal-100 text-brand-darkText rounded-[18px_18px_4px_18px]'
            : 'bg-white border border-teal-200 shadow-sm text-gray-700 rounded-[18px_18px_18px_4px]'
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {message.interrupted && (
          <p className="flex items-center gap-1 text-amber-500 text-xs mt-1 font-medium">
            <AlertTriangle className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
            {streamInterruptedLabel ?? 'Response was interrupted.'}
          </p>
        )}
      </div>
    </div>
  )
}
