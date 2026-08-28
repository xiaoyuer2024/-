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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  const data = (await response.json()) as T & { message?: string; ok?: boolean }
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
