'use client'

import { useRef, type KeyboardEvent } from 'react'
import TextareaAutosize from 'react-textarea-autosize'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  disabled?: boolean
  placeholder?: string
}

export default function MessageInput({ value, onChange, onSend, disabled, placeholder }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && value.trim()) onSend()
    }
  }

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">
      <div className="max-w-3xl mx-auto flex items-end gap-2">
        <TextareaAutosize
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          minRows={1}
          maxRows={5}
          className={cn(
            'flex-1 resize-none rounded-xl border border-teal-200 bg-teal-50',
            'px-4 py-2.5 text-sm text-gray-700 placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1',
            'transition-colors disabled:opacity-50',
            'motion-reduce:transition-none'
          )}
          aria-label={placeholder}
        />
        <button
          onClick={() => { if (!disabled && value.trim()) onSend() }}
          disabled={disabled || !value.trim()}
          aria-label="Send message"
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
            'bg-teal-500 hover:bg-teal-600 text-white',
            'transition-colors duration-200 cursor-pointer',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2',
            'motion-reduce:transition-none'
          )}
        >
          <Send className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
