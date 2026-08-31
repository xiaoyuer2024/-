/** Kuaishou clue-conversion helpers (线索类 API). */

export const DEFAULT_ACTIVATE_URL = 'https://ad.partner.gifshow.com/track/activate'

/** Official event: 付费（支付成功记一笔成交）. Amount required. */
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
  let q = String(search || '').trim()
  try {
    if (/^https?:\/\//i.test(q)) {
      const url = new URL(q)
      q = `${url.search}&${url.hash.replace(/^#/, '')}`
    }
  } catch {
    /* keep q */
  }
  q = q.replace(/^[?#]/, '')
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
    advertiser_id: get('advertiser_id', 'account_id'),
    ks_user_id: get('ks_user_id', 'kid', 'kuaishou_id'),
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
    utm_source: get('utm_source'),
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
  eventType = EVENT_PAY_SUCCESS,
  eventTime = Date.now(),
  purchaseAmount,
  dryRun = false,
  fetchImpl = fetch,
}) {
  const token = extractCallback(callback)
  if (!token) {
    return {
      ok: false,
      skipped: true,
      reason: 'missing_or_placeholder_callback',
      event_type: eventType,
      message: '落地页 callback 仍是 __CALLBACK__ 或为空。请从快手广告真实点击进入后再测付费。',
    }
  }

  const url = buildActivateUrl({
    activateUrl,
    callback: token,
    eventType,
    eventTime,
    purchaseAmount,
  })

  if (dryRun) {
    return {
      ok: true,
      dry_run: true,
      skipped: false,
      event_type: eventType,
      event_time: eventTime,
      purchase_amount: Number(purchaseAmount).toFixed(2),
      activate_url: url,
    }
  }

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      signal: AbortSignal.timeout(8000),
    })
    const text = await response.text()
    let parsed = null
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = { raw: text }
    }

    const decodedFailed =
      typeof text === 'string' && text.toLowerCase().includes('callbackinfo decoded')
    const resultOk = parsed && typeof parsed === 'object' && Number(parsed.result) === 1

    return {
      ok: response.ok && !decodedFailed && (resultOk || parsed?.result == null),
      dry_run: false,
      skipped: false,
      event_type: eventType,
      event_time: eventTime,
      purchase_amount: Number(purchaseAmount).toFixed(2),
      activate_url: url,
      http_status: response.status,
      kuaishou: parsed,
      error_msg: decodedFailed
        ? 'callbackinfo decoded failure：callback 不是快手点击下发的原值'
        : null,
    }
  } catch (error) {
    return {
      ok: false,
      dry_run: false,
      skipped: false,
      event_type: eventType,
      event_time: eventTime,
      purchase_amount: Number(purchaseAmount).toFixed(2),
      activate_url: url,
      error_msg: error instanceof Error ? error.message : '回传请求失败',
    }
  }
}
