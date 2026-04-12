import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { createServiceClient } from '@/lib/supabase/server'
import {
  aggregateForGemini,
  buildGeminiPrompt,
  stripMarkdownWrapper,
  type MonthlyRow,
} from '@/lib/admin/services/ai-analysis'

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await requireAdmin()
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const db = createServiceClient()

    // Always query ALL data — no NPP or category filters for AI analysis
    const [salesResult, purchaseResult] = await Promise.all([
      db.rpc('dashboard_door_monthly', { p_npp: '', p_nganh: '', p_thuong_hieu: '', p_kenh: '' }),
      db.rpc('dashboard_dpur_monthly', { p_npp: '', p_nganh: '', p_thuong_hieu: '' }),
    ])

    const salesRows: MonthlyRow[] = ((salesResult.data as Array<{ year: number; month: number; ban_hang: number }> | null) ?? []).map(
      r => ({ year: r.year, month: r.month, value: r.ban_hang ?? 0 })
    )

    const purchaseRows: MonthlyRow[] = ((purchaseResult.data as Array<{ year: number; month: number; nhap_hang: number }> | null) ?? []).map(
      r => ({ year: r.year, month: r.month, value: r.nhap_hang ?? 0 })
    )

    const currentDate = new Date().toISOString().slice(0, 10)
    const payload = aggregateForGemini(salesRows, purchaseRows, currentDate)
    const { system_instruction, user_message } = buildGeminiPrompt(payload)

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system_instruction }] },
        contents: [{ role: 'user', parts: [{ text: user_message }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!geminiRes.ok) {
      console.error('[ai-analysis] Gemini API error:', geminiRes.status)
      return NextResponse.json({ error: 'Gemini API error' }, { status: 500 })
    }

    const geminiData = await geminiRes.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const rawHtml = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const html = stripMarkdownWrapper(rawHtml)

    return NextResponse.json({ html })
  } catch (err) {
    console.error('[ai-analysis] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
