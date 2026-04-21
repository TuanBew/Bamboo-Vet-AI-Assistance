import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { query } from '@/lib/mysql/client'
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
    // LEGACY SUPABASE: db.rpc('dashboard_door_monthly', { p_npp: '', p_nganh: '', p_thuong_hieu: '', p_kenh: '' })
    // LEGACY SUPABASE: db.rpc('dashboard_dpur_monthly', { p_npp: '', p_nganh: '', p_thuong_hieu: '' })

    // Always query ALL data — no NPP or category filters for AI analysis
    interface SalesRow { year: number; month: number; ban_hang: number }
    interface PurchaseRow { year: number; month: number; nhap_hang: number }

    const [salesResult, purchaseResult] = await Promise.all([
      query<SalesRow>(`
        SELECT YEAR(OffDate) AS year, MONTH(OffDate) AS month,
               SUM(OffAmt + OffTaxAmt - IFNULL(OffDsc, 0)) AS ban_hang
        FROM \`_door\`
        GROUP BY YEAR(OffDate), MONTH(OffDate)
        ORDER BY year, month
      `, []),
      query<PurchaseRow>(`
        SELECT YEAR(PurDate) AS year, MONTH(PurDate) AS month,
               SUM(PRAmt + PRTaxAmt) AS nhap_hang
        FROM \`_dpur\`
        WHERE Trntyp = 'I' AND Program_ID = '0'
        GROUP BY YEAR(PurDate), MONTH(PurDate)
        ORDER BY year, month
      `, []),
    ])

    const salesRows: MonthlyRow[] = salesResult.map(
      r => ({ year: Number(r.year), month: Number(r.month), value: Number(r.ban_hang ?? 0) })
    )

    const purchaseRows: MonthlyRow[] = purchaseResult.map(
      r => ({ year: Number(r.year), month: Number(r.month), value: Number(r.nhap_hang ?? 0) })
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
      const status = geminiRes.status === 429 ? 429 : 500
      const error = geminiRes.status === 429 ? 'Rate limit exceeded, please try again later' : 'Gemini API error'
      return NextResponse.json({ error }, { status })
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
