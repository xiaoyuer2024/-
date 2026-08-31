const STORAGE_KEY = 'clarum_ks_click'
const COOKIE_KEY = 'clarum_cb'
const MACRO = /^__+[A-Z0-9]+_*__$/i

function isMacro(value: string | null | undefined) {
  return !value || MACRO.test(String(value).trim())
}

export function readQueryBag(raw: string): URLSearchParams {
  const params = new URLSearchParams()
  let text = String(raw || '').trim()
  try {
    if (/^https?:\/\//i.test(text)) {
      const url = new URL(text)
      text = `${url.search}&${url.hash.replace(/^#/, '')}`
    }
  } catch {
    /* keep text */
  }
  text = text.replace(/^[?#]/, '')
  const parsed = new URLSearchParams(text)
  parsed.forEach((value, key) => {
    if (value && !params.has(key)) params.set(key, value)
  })
  return params
}

export function pickCallback(params: URLSearchParams): string | null {
  const raw = params.get('callback') || params.get('CALLBACK') || params.get('ks_callback') || ''
  const trimmed = raw.trim()
  if (!trimmed || isMacro(trimmed)) return null
  if (/^https?:\/\//i.test(trimmed) || /%3A%2F%2F/i.test(trimmed)) {
    try {
      const decoded = /%3A%2F%2F/i.test(trimmed) ? decodeURIComponent(trimmed) : trimmed
      const nested = readQueryBag(decoded)
      return pickCallback(nested)
    } catch {
      return trimmed
    }
  }
  return trimmed
}

function readCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const parts = document.cookie.split(';')
  for (const part of parts) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return ''
}

function persistCallback(token: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, token)
  } catch {
    /* private mode */
  }
  try {
    document.cookie = `${COOKIE_KEY}=${encodeURIComponent(token)};path=/;max-age=86400;SameSite=Lax`
  } catch {
    /* ignore */
  }
}

export function collectClickSearch(): string {
  const merged = new URLSearchParams()
  const sources: string[] = []
  if (typeof window !== 'undefined') {
    sources.push(window.location.search)
    if (window.location.hash.includes('=')) sources.push(window.location.hash)
    if (document.referrer) sources.push(document.referrer)
  }
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored) merged.set('callback', stored)
  } catch {
    /* ignore */
  }
  const cookieCb = readCookie(COOKIE_KEY)
  if (cookieCb && !merged.get('callback')) merged.set('callback', cookieCb)

  for (const source of sources) {
    const bag = readQueryBag(source)
    bag.forEach((value, key) => {
      if (!value) return
      if (key.toLowerCase() === 'callback' && isMacro(value)) return
      if (!merged.get(key)) merged.set(key, value)
    })
  }

  const token = pickCallback(merged)
  if (token) persistCallback(token)
  const query = merged.toString()
  return query ? `?${query}` : ''
}

export function isDebugLanding(): boolean {
  if (typeof window === 'undefined') return false
  const params = readQueryBag(window.location.search)
  return params.get('debug') === '1'
}
