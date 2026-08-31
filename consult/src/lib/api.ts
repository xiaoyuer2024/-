export type Product = {
  name: string
  price: string
  list_price: string
  currency: string
  payment_mode: string
}

export type KuaishouReport = {
  ok: boolean
  skipped?: boolean
  dry_run?: boolean
  reason?: string
  message?: string
  event_type?: number
  event_time?: number
  purchase_amount?: string
  activate_url?: string
  http_status?: number
  error_msg?: string | null
  kuaishou?: { result?: number; error_msg?: string; raw?: string }
}

type PhpAct = { act: string; id?: string }

function phpAct(path: string): PhpAct {
  const pay = path.match(/^\/api\/orders\/([^/]+)\/(pay|replay-kuaishou)$/)
  if (pay) {
    return { act: pay[2] === 'pay' ? 'order_pay' : 'order_replay', id: pay[1] }
  }
  const table: Record<string, string> = {
    '/api/health': 'health',
    '/api/product': 'product',
    '/api/track/click': 'track_click',
    '/api/inquiries': 'inquiries',
    '/api/orders': 'orders',
  }
  return { act: table[path] || 'unknown' }
}

function apiUrl(path: string): string {
  const prefix = import.meta.env.VITE_API_PREFIX || '/api'
  if (!prefix.includes('.php')) return path
  const { act, id } = phpAct(path)
  const query = new URLSearchParams({ act })
  if (id) query.set('id', id)
  return `${prefix}?${query.toString()}`
}

function explainNonJson(text: string): string {
  const php = text.match(/<b>(Fatal error|Warning|Parse error|Notice)<\/b>:\s*([^<\n]+)/i)
  if (php) {
    const detail = php[2].trim().slice(0, 180)
    if (/permission denied|failed to open stream|不可写/i.test(detail)) {
      return '服务器无法写入 data 目录。请在网站根目录执行 chmod -R 777 data 后重试。'
    }
    return `服务器 PHP 报错：${detail}`
  }
  if (/<br\s*\/?>/i.test(text)) {
    return '接口返回了 PHP 错误页。请把 data 目录权限设为 777，并确认网站已启用 PHP。'
  }
  return '接口没有返回 JSON。请确认 api.php 在网站根目录，且网站类型为 PHP。'
}

function parsePayload(text: string): { message?: string; ok?: boolean } {
  const trimmed = text.replace(/^\uFEFF/, '').trim()
  if (!trimmed) throw new Error('接口没有返回内容')
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1))
      } catch {
        /* fall through */
      }
    }
    throw new Error(explainNonJson(trimmed))
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const php = (import.meta.env.VITE_API_PREFIX || '').includes('.php')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  }
  let body = init?.body
  if (php && typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>
      const { act, id } = phpAct(path)
      body = JSON.stringify({ _act: act, _id: id || '', ...parsed })
    } catch {
      /* keep original body */
    }
  } else if (php && !body && (init?.method || 'GET').toUpperCase() === 'POST') {
    const { act, id } = phpAct(path)
    body = JSON.stringify({ _act: act, _id: id || '' })
  }

  const response = await fetch(apiUrl(path), { ...init, headers, body })
  const text = await response.text()
  const data = parsePayload(text) as T & { message?: string; ok?: boolean }
  if (!response.ok) {
    throw new Error(data.message || '请求失败')
  }
  return data
}

export const api = {
  health: () => request<{ ok: boolean; kuaishou_dry_run: boolean; payment_mode: string }>('/api/health'),
  product: () => request<Product>('/api/product'),
  trackClick: (search: string) =>
    request<{
      click_id: string
      click: {
        has_callback: boolean
        callback_preview?: string
        advertiser_id?: string
        ks_user_id?: string
      }
    }>('/api/track/click', {
      method: 'POST',
      body: JSON.stringify({ search, page_url: window.location.href }),
    }),
  createInquiry: (payload: { click_id: string | null; topic: string; question: string; name: string }) =>
    request<{ inquiry_id: string }>('/api/inquiries', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createOrder: (inquiry_id: string) =>
    request<{
      order_id: string
      order: {
        amount: string
        list_price: string
        product_name: string
        payment_mode: string
        has_callback: boolean
      }
    }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ inquiry_id }),
    }),
  payOrder: (order_id: string) =>
    request<{
      ok: boolean
      order: { id: string; amount: string; paid_at: string; status: string }
      inquiry: { question: string; topic: string; name: string }
      kuaishou: KuaishouReport
    }>(`/api/orders/${order_id}/pay`, { method: 'POST' }),
  replayKuaishou: (order_id: string) =>
    request<{
      ok: boolean
      order: { id: string; amount: string; paid_at: string; status: string }
      kuaishou: KuaishouReport
    }>(`/api/orders/${order_id}/replay-kuaishou`, { method: 'POST' }),
}
