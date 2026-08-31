import express from 'express'
import { randomUUID } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseClickQuery, reportPaySuccess } from './kuaishou.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadEnv() {
  const path = join(root, '.env')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnv()

const PORT = Number(process.env.PORT || 8787)
const DRY_RUN = String(process.env.KUAISHOU_DRY_RUN ?? 'false') === 'true'
const PAYMENT_MODE = process.env.PAYMENT_MODE || 'sandbox'
const PRICE = Number(process.env.PRODUCT_PRICE || '9.90')
const LIST_PRICE = Number(process.env.PRODUCT_LIST_PRICE || '68.00')
const PRODUCT_NAME = process.env.PRODUCT_NAME || '澄室一对一情感咨询'
const ACTIVATE_URL =
  process.env.KUAISHOU_ACTIVATE_URL || 'https://ad.partner.gifshow.com/track/activate'

const clicks = new Map()
const inquiries = new Map()
const orders = new Map()

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '32kb' }))

function publicClick(click) {
  if (!click) return null
  const token = click.callback || ''
  return {
    id: click.id,
    has_callback: Boolean(click.callback),
    callback_preview: token
      ? `${token.slice(0, 10)}…${token.slice(-6)}（${token.length}字）`
      : '',
    click_type: click.click_type,
    advertiser_id: click.advertiser_id,
    ks_user_id: click.ks_user_id,
    cid: click.cid,
    csite: click.csite,
    created_at: click.created_at,
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    product: PRODUCT_NAME,
    price: PRICE.toFixed(2),
    list_price: LIST_PRICE.toFixed(2),
    payment_mode: PAYMENT_MODE,
    kuaishou_dry_run: DRY_RUN,
    kuaishou_event_type: 3,
    kuaishou_event_name: '付费成交',
  })
})

app.get('/api/product', (_req, res) => {
  res.json({
    name: PRODUCT_NAME,
    price: PRICE.toFixed(2),
    list_price: LIST_PRICE.toFixed(2),
    currency: 'CNY',
    payment_mode: PAYMENT_MODE,
  })
})

app.post('/api/track/click', (req, res) => {
  const search = req.body?.search || ''
  const pageUrl = req.body?.page_url || ''
  const parsed = parseClickQuery(search)
  const fromPage = parseClickQuery(pageUrl)
  const cookieHeader = String(req.headers.cookie || '')
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)clarum_cb=([^;]+)/)
  const cookieCb = cookieMatch ? decodeURIComponent(cookieMatch[1]) : ''
  const clickData = {
    ...fromPage,
    ...parsed,
    callback: parsed.callback || fromPage.callback || parseClickQuery(`callback=${cookieCb}`).callback,
  }
  const id = randomUUID()
  const click = {
    id,
    ...clickData,
    page_url: pageUrl,
    created_at: new Date().toISOString(),
  }
  if (click.callback) {
    res.setHeader('Set-Cookie', `clarum_cb=${encodeURIComponent(click.callback)}; Path=/; Max-Age=86400; SameSite=Lax`)
  }
  clicks.set(id, click)
  res.json({ click_id: id, click: publicClick(click) })
})

app.post('/api/inquiries', (req, res) => {
  const question = String(req.body?.question || '').trim()
  const topic = String(req.body?.topic || '').trim()
  const name = String(req.body?.name || '').trim()
  if (question.length < 8) {
    return res.status(400).json({ ok: false, message: '请把心事写得更具体一些（至少 8 个字）' })
  }
  if (req.body?.phone) {
    return res.status(400).json({ ok: false, message: '本咨询不收集电话号码' })
  }
  const id = randomUUID()
  const inquiry = {
    id,
    click_id: req.body?.click_id || null,
    topic,
    name: name || '匿名来访者',
    question,
    created_at: new Date().toISOString(),
  }
  inquiries.set(id, inquiry)
  res.json({ inquiry_id: id, inquiry })
})

app.post('/api/orders', (req, res) => {
  const inquiry = inquiries.get(req.body?.inquiry_id)
  if (!inquiry) {
    return res.status(404).json({ ok: false, message: '咨询单不存在' })
  }
  const click = inquiry.click_id ? clicks.get(inquiry.click_id) : null
  const id = randomUUID()
  const order = {
    id,
    inquiry_id: inquiry.id,
    click_id: inquiry.click_id,
    amount: PRICE.toFixed(2),
    status: 'pending',
    created_at: new Date().toISOString(),
    paid_at: null,
    kuaishou: null,
  }
  orders.set(id, order)
  res.json({
    order_id: id,
    order: {
      ...order,
      product_name: PRODUCT_NAME,
      list_price: LIST_PRICE.toFixed(2),
      payment_mode: PAYMENT_MODE,
      has_callback: Boolean(click?.callback),
      advertiser_id: click?.advertiser_id || '',
      ks_user_id: click?.ks_user_id || '',
    },
  })
})

app.get('/api/orders/:id', (req, res) => {
  const order = orders.get(req.params.id)
  if (!order) return res.status(404).json({ ok: false, message: '订单不存在' })
  const inquiry = inquiries.get(order.inquiry_id)
  res.json({ order, inquiry })
})

app.post('/api/orders/:id/pay', async (req, res) => {
  const order = orders.get(req.params.id)
  if (!order) return res.status(404).json({ ok: false, message: '订单不存在' })
  if (order.status === 'paid') {
    return res.json({ ok: true, order, kuaishou: order.kuaishou, idempotent: true })
  }
  if (PAYMENT_MODE !== 'sandbox') {
    return res.status(501).json({
      ok: false,
      message: '正式支付通道未配置。请接入微信/支付宝后，在支付异步回调中调用回传。',
    })
  }

  const inquiry = inquiries.get(order.inquiry_id)
  const click = inquiry?.click_id ? clicks.get(inquiry.click_id) : null
  const eventTime = Date.now()
  const kuaishou = await reportPaySuccess({
    activateUrl: ACTIVATE_URL,
    callback: click?.callback,
    eventTime,
    purchaseAmount: order.amount,
    dryRun: DRY_RUN,
  })
  console.log('[clarum] kuaishou conversion', {
    order_id: order.id,
    advertiser_id: click?.advertiser_id,
    ks_user_id: click?.ks_user_id,
    has_callback: Boolean(click?.callback),
    dry_run: DRY_RUN,
    skipped: kuaishou.skipped,
    ok: kuaishou.ok,
    event_type: kuaishou.event_type,
    error_msg: kuaishou.error_msg,
  })

  order.status = 'paid'
  order.paid_at = new Date(eventTime).toISOString()
  order.kuaishou = kuaishou
  orders.set(order.id, order)

  res.json({
    ok: true,
    order,
    inquiry,
    kuaishou,
    click: publicClick(click),
  })
})

app.post('/api/orders/:id/replay-kuaishou', async (req, res) => {
  const order = orders.get(req.params.id)
  if (!order) return res.status(404).json({ ok: false, message: '订单不存在' })
  if (order.status !== 'paid') {
    return res.status(400).json({ ok: false, message: '请先完成模拟支付' })
  }
  const inquiry = inquiries.get(order.inquiry_id)
  const click = inquiry?.click_id ? clicks.get(inquiry.click_id) : null
  const eventTime = Date.now()
  const kuaishou = await reportPaySuccess({
    activateUrl: ACTIVATE_URL,
    callback: click?.callback,
    eventTime,
    purchaseAmount: order.amount,
    dryRun: DRY_RUN,
  })
  order.kuaishou = kuaishou
  orders.set(order.id, order)
  console.log('[clarum] kuaishou replay', {
    order_id: order.id,
    skipped: kuaishou.skipped,
    ok: kuaishou.ok,
    error_msg: kuaishou.error_msg,
  })
  res.json({ ok: true, order, inquiry, kuaishou, click: publicClick(click) })
})

if (process.env.NODE_ENV === 'production') {
  const dist = join(root, 'dist')
  app.use(express.static(dist))
  app.get('*', (_req, res) => {
    res.sendFile(join(dist, 'index.html'))
  })
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `[clarum] api :${PORT}  price=${PRICE.toFixed(2)}  dry_run=${DRY_RUN}  payment=${PAYMENT_MODE}`,
  )
})
