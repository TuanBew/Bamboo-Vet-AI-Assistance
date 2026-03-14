'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/LanguageContext'

interface Props {
  id: string
  title: string
  active: boolean
}

export default function ConversationItem({ id, title, active }: Props) {
  const t = useT()
  const router = useRouter()
  const [editing, setEditing]   = useState(false)
  const [newTitle, setNewTitle] = useState(title)
  const [hovered, setHovered]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  async function saveRename() {
    if (!newTitle.trim() || newTitle === title) { setEditing(false); return }
    const res = await fetch(`/api/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim() }),
    })
    if (!res.ok) { console.error('Failed to rename conversation'); setEditing(false); return }
    setEditing(false)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm(t('sidebar.deleteConfirm'))) return
    const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
    if (!res.ok) { console.error('Failed to delete conversation'); return }
    if (active) router.push('/app')
    router.refresh()
  }

  return (
    <div
      className={cn(
        'group relative flex items-center rounded-lg px-3 py-2 text-sm cursor-pointer',
        'transition-colors duration-150',
        active ? 'bg-teal-200 text-brand-darkText' : 'hover:bg-teal-100 text-gray-700'
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (!editing) router.push(`/app/conversation/${id}`) }}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onBlur={saveRename}
          onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setEditing(false) }}
          className="flex-1 bg-transparent border-b border-teal-400 outline-none text-sm"
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 truncate">{title}</span>
      )}

      {(hovered || active) && !editing && (
        <div className="flex gap-1 ml-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setEditing(true)}
            aria-label={t('sidebar.rename')}
            className="p-1 rounded hover:bg-teal-200 cursor-pointer transition-colors"
          >
            <Pencil className="w-3 h-3 text-gray-500" aria-hidden="true" />
          </button>
          <button
            onClick={handleDelete}
            aria-label={t('sidebar.delete')}
            className="p-1 rounded hover:bg-red-100 cursor-pointer transition-colors"
          >
            <Trash2 className="w-3 h-3 text-red-400" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
