/** Kuaishou clue-conversion helpers (线索类 API). */

export const DEFAULT_ACTIVATE_URL = 'https://ad.partner.gifshow.com/track/activate'

/** Official event: 付费. Amount required. */
export const EVENT_PAY_SUCCESS = 3

const MACRO = /^__+[A-Z0-9]+_*__$/i

export function extractCallback(raw) {
  if (raw == null) return null
  const trimmed = String(raw).trim()
  if (!trimmed || MACRO.test(trimmed)) return null

  const fromUrl = (value) => {
    try {
      const url = new URL(value)
      const cb = url.searchParams.get('callback') || url.searchParams.get('CALLBACK')
      return cb && !MACRO.test(cb) ? cb : null
    } catch {
      return null
    }
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return fromUrl(trimmed) || null
  }

  if (/%3A%2F%2F/i.test(trimmed) || /%3a%2f%2f/i.test(trimmed)) {
    try {
      const decoded = decodeURIComponent(trimmed)
      if (/^https?:\/\//i.test(decoded)) return fromUrl(decoded)
    } catch {
      /* keep token */
    }
  }

  return trimmed
}

export function parseClickQuery(search) {
  const q = String(search || '').replace(/^\?/, '')
  const params = new URLSearchParams(q)
  const get = (...keys) => {
    for (const key of keys) {
      const value = params.get(key)
      if (value) return value
    }
    return ''
  }

  return {
    callback: extractCallback(get('callback', 'CALLBACK')),
    click_type: get('click_type'),
    ip: get('ip'),
    ts: get('ts'),
    ua: get('ua'),
    os: get('os'),
    cid: get('cid'),
    csite: get('csite'),
    oaid: get('oaid'),
    imei_md5: get('imei_md5'),
    android_id_md5: get('android_id_md5'),
    idfa: get('idfa'),
    aid: get('aid'),
    did: get('did'),
    dname: get('dname'),
  }
}

export function isPlaceholderMacro(value) {
  return !value || MACRO.test(String(value).trim())
}

export function buildActivateUrl({
  activateUrl = DEFAULT_ACTIVATE_URL,
  callback,
  eventType,
  eventTime,
  purchaseAmount,
}) {
  if (!callback) {
    throw new Error('callback is required')
  }
  const url = new URL(activateUrl)
  url.searchParams.set('callback', callback)
  url.searchParams.set('event_type', String(eventType))
  url.searchParams.set('event_time', String(eventTime))
  if (purchaseAmount != null && purchaseAmount !== '') {
    url.searchParams.set('purchase_amount', Number(purchaseAmount).toFixed(2))
  }
  return url.toString()
}

export async function reportPaySuccess({
  activateUrl = DEFAULT_ACTIVATE_URL,
  callback,
  eventTime = Date.now(),
  purchaseAmount,
  dryRun = true,
  fetchImpl = fetch,
}) {
  const token = extractCallback(callback)
  if (!token) {
    return {
      ok: false,
      skipped: true,
      reason: 'missing_or_placeholder_callback',
      event_type: EVENT_PAY_SUCCESS,
    }
  }

  const url = buildActivateUrl({
    activateUrl,
    callback: token,
    eventType: EVENT_PAY_SUCCESS,
    eventTime,
    purchaseAmount,
  })

  if (dryRun) {
    return {
      ok: true,
      dry_run: true,
      skipped: false,
      event_type: EVENT_PAY_SUCCESS,
      event_time: eventTime,
      purchase_amount: Number(purchaseAmount).toFixed(2),
      activate_url: url,
    }
  }

  const response = await fetchImpl(url, { method: 'GET' })
  const text = await response.text()
  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { raw: text }
  }

  const decodedFailed =
    typeof text === 'string' && text.toLowerCase().includes('callbackinfo decoded')

  return {
    ok: response.ok && !decodedFailed,
    dry_run: false,
    skipped: false,
    event_type: EVENT_PAY_SUCCESS,
    event_time: eventTime,
    purchase_amount: Number(purchaseAmount).toFixed(2),
    activate_url: url,
    http_status: response.status,
    kuaishou: parsed,
    error_msg: decodedFailed ? 'callbackinfo decoded failure' : null,
  }
}
