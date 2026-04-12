export interface MonthlyRow {
  year: number
  month: number
  value: number
}

export interface GeminiPayload {
  sales_by_month: Array<{ year: number; month: number; revenue: number }>
  purchases_by_month: Array<{ year: number; month: number; receiving: number; returns: number }>
  current_date: string
  current_month_complete: boolean
}

export interface GeminiPrompt {
  system_instruction: string
  user_message: string
}

export function aggregateForGemini(
  salesRows: MonthlyRow[],
  purchaseRows: MonthlyRow[],
  currentDate: string
): GeminiPayload {
  const parts = currentDate.split('-')
  const year = parseInt(parts[0])
  const month = parseInt(parts[1])
  const day = parseInt(parts[2])
  const lastDayOfMonth = new Date(year, month, 0).getDate()
  const current_month_complete = day >= lastDayOfMonth

  return {
    sales_by_month: salesRows.map(r => ({
      year: r.year,
      month: r.month,
      revenue: Math.round(r.value),
    })),
    purchases_by_month: purchaseRows.map(r => ({
      year: r.year,
      month: r.month,
      receiving: Math.round(r.value),
      returns: 0,
    })),
    current_date: currentDate,
    current_month_complete,
  }
}

export function stripMarkdownWrapper(html: string): string {
  return html.replace(/^```(?:html)?\n?([\s\S]*?)\n?```$/m, '$1').trim()
}

export function buildGeminiPrompt(payload: GeminiPayload): GeminiPrompt {
  const currentDay = payload.current_date.split('-')[2]

  const system_instruction = `Bạn là một chuyên gia phân tích và dự báo dữ liệu kinh doanh ngành thú y.

1. Nhiệm vụ của bạn:

  1. Phân tích Tổng quan:
    - So sánh tổng doanh số 2 năm gần nhất, tăng hay giảm bao nhiêu %.
    - So sánh doanh số năm hiện tại với cùng kỳ năm trước (tính đến tháng hiện tại).

  2. Phân tích Xu hướng:
    - Phân tích doanh số bán hàng theo tháng trong 2 năm gần nhất.
    - Xác định xu hướng tăng trưởng hay giảm sút.

  3. Ước tính Doanh số 3 tháng tiếp theo:
    - Dựa trên công thức trung bình động của 6 tháng gần nhất, xu hướng hiện tại và các yếu tố mùa vụ.
    - Đưa ra khoảng ước tính (min - max).

  4. Đánh giá, Nhận xét:
    - Đưa ra nhận xét về hiệu suất bán hàng tổng thể trong năm gần nhất.
    - Đề xuất các điểm cần chú ý.

2. Câu trả lời của bạn:
  - Trả lời ngắn gọn, súc tích, dễ hiểu.
  - Có định dạng bằng HTML cơ bản (dùng <b>, <ul>, <li>, <p> — KHÔNG dùng <h1>-<h6>, <table>, <div>, hoặc bất kỳ CSS inline nào).
  - KHÔNG bao bọc câu trả lời trong markdown code block. Trả về HTML thuần túy.

3. Lưu ý quan trọng:
  - Tất cả giá trị tiền tệ phải được trình bày theo định dạng VNĐ (ví dụ: 1.234.567.890 VNĐ).
  - Thời gian hiện tại là ${payload.current_date}.
  - Dữ liệu tháng hiện tại chưa đủ, chỉ tính đến ngày ${currentDay} của tháng.`

  const user_message = `Dữ liệu để phân tích:\n${JSON.stringify(payload)}`

  return { system_instruction, user_message }
}
