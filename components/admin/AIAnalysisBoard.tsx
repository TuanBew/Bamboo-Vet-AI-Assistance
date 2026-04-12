'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import DOMPurify from 'isomorphic-dompurify'
import { VI } from '@/lib/i18n/vietnamese'
import type { DashboardFilters } from '@/lib/admin/services/dashboard'

type AIBoardStatus = 'waiting' | 'loading' | 'ready' | 'error'

interface Props {
  committedFilters: DashboardFilters
}

const ALLOWED_TAGS = ['b', 'strong', 'em', 'ul', 'ol', 'li', 'p', 'br']

export function AIAnalysisBoard({ committedFilters }: Props) {
  const [status, setStatus] = useState<AIBoardStatus>('waiting')
  const [htmlContent, setHtmlContent] = useState<string | null>(null)
  const [gateOpen, setGateOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [cache] = useState(() => new Map<string, string>())

  // Always sync latest filters to ref -- does NOT restart the timer
  const filtersRef = useRef(committedFilters)
  useEffect(() => { filtersRef.current = committedFilters }, [committedFilters])

  const fetchAI = useCallback(async (filters: DashboardFilters) => {
    setStatus('loading')
    try {
      const res = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters }),
      })
      if (!res.ok) throw new Error()
      const { html } = await res.json() as { html: string }
      const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: [] })
      cache.set(JSON.stringify(filters), clean)
      setHtmlContent(clean)
      setStatus('ready')
      setGateOpen(true)
    } catch {
      setStatus('error')
    }
  }, [cache])

  // Mount effect: one-shot 10s timer. Does NOT reset on filter changes.
  useEffect(() => {
    const cacheKey = JSON.stringify(filtersRef.current)
    if (cache.has(cacheKey)) {
      setHtmlContent(cache.get(cacheKey)!)
      setStatus('ready')
      setGateOpen(true)
      return
    }
    setStatus('waiting')
    const timer = setTimeout(() => { void fetchAI(filtersRef.current) }, 10_000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // empty deps -- fires once on mount

  // After gate is open: immediate re-fetch on filter change
  useEffect(() => {
    if (!gateOpen) return
    const cacheKey = JSON.stringify(committedFilters)
    if (cache.has(cacheKey)) {
      setHtmlContent(cache.get(cacheKey)!)
      setStatus('ready')
      return
    }
    void fetchAI(committedFilters)
  }, [committedFilters, gateOpen, cache, fetchAI])

  return (
    <div
      data-testid="ai-analysis-board"
      className="bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-600" />
          <span className="font-semibold text-amber-800 text-sm">{VI.aiAnalysis.title}</span>
        </div>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="text-amber-600 hover:text-amber-800 transition-colors"
          aria-label={collapsed ? 'Mo rong' : 'Thu gon'}
        >
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="px-4 pb-4">
          {status === 'waiting' && (
            <div data-testid="ai-analysis-status-waiting" className="flex items-center gap-2 text-amber-700 text-sm py-2">
              <span className="animate-pulse">{VI.aiAnalysis.waiting}</span>
            </div>
          )}

          {status === 'loading' && (
            <div data-testid="ai-analysis-status-loading" className="flex items-center gap-2 text-amber-700 text-sm py-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>{VI.aiAnalysis.loading}</span>
            </div>
          )}

          {status === 'ready' && htmlContent && (
            <div
              data-testid="ai-analysis-status-ready"
              className="text-sm text-gray-800 space-y-1"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          )}

          {status === 'error' && (
            <div data-testid="ai-analysis-status-error" className="flex items-center gap-3 text-sm py-2">
              <span className="text-red-600">{VI.aiAnalysis.error}</span>
              <button
                onClick={() => { void fetchAI(filtersRef.current) }}
                className="text-amber-700 underline hover:text-amber-900 font-medium"
              >
                {VI.aiAnalysis.retry}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
