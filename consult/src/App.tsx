import { useEffect, useMemo, useState } from 'react'
import { api, type KuaishouReport, type Product } from './lib/api'
import { collectClickSearch, isDebugLanding } from './lib/click'
import { COUNSELORS, TOPICS, matchCounselor, writeReading } from './lib/reading'

type Stage = 'home' | 'compose' | 'matching' | 'offer' | 'pay' | 'reading'

function classNames(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(' ')
}

function conversionVerdict(report: KuaishouReport | null) {
  if (!report) {
    return { tone: 'skip' as const, title: '尚未回传', hint: '请先完成模拟支付。' }
  }
  if (report.skipped) {
    return {
      tone: 'skip' as const,
      title: '链路中断：没有真实 callback',
      hint: '必须从快手广告点击进入本页，地址栏 callback 不能是 __CALLBACK__。',
    }
  }
  if (report.dry_run) {
    return {
      tone: 'skip' as const,
      title: '演练模式：没有真正请求快手',
      hint: '把 KUAISHOU_DRY_RUN 设为 false 后重试。',
    }
  }
  if (report.ok && Number(report.kuaishou?.result) === 1) {
    return {
      tone: 'ok' as const,
      title: '链路正常：快手已接收成交',
      hint: '可到磁力引擎转化明细核对此 callback 的付费事件。',
    }
  }
  if (report.ok) {
    return {
      tone: 'ok' as const,
      title: '已向快手发出成交回传',
      hint: '请对照下方原始返回。result=1 才表示后台认了这笔。',
    }
  }
  return {
    tone: 'skip' as const,
    title: '已请求，但快手未确认成交',
    hint: report.error_msg || report.kuaishou?.error_msg || '检查 callback 是否为点击下发的原值。',
  }
}

function PayQr({ seed }: { seed: string }) {
  const cells = useMemo(() => {
    const out: boolean[] = []
    let n = 0
    for (let i = 0; i < seed.length; i++) n = (n * 33 + seed.charCodeAt(i)) >>> 0
    for (let i = 0; i < 121; i++) {
      n = (n * 1664525 + 1013904223) >>> 0
      out.push(n % 3 !== 0)
    }
    return out
  }, [seed])

  return (
    <div className="qr" aria-hidden="true">
      {cells.map((on, i) => (
        <span key={i} className={on ? 'on' : ''} />
      ))}
    </div>
  )
}

export default function App() {
  const [stage, setStage] = useState<Stage>('home')
  const [product, setProduct] = useState<Product | null>(null)
  const [clickId, setClickId] = useState<string | null>(null)
  const [hasCallback, setHasCallback] = useState(false)
  const [callbackPreview, setCallbackPreview] = useState('')
  const [advertiserId, setAdvertiserId] = useState('')
  const [ksUserId, setKsUserId] = useState('')
  const [debugMode] = useState(() => isDebugLanding())
  const [testMode, setTestMode] = useState(false)
  const [topic, setTopic] = useState('intent')
  const [name, setName] = useState('')
  const [question, setQuestion] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [inquiryId, setInquiryId] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState<KuaishouReport | null>(null)
  const [paidAmount, setPaidAmount] = useState('9.90')

  const counselor = useMemo(() => matchCounselor(topic, question), [topic, question])
  const reading = useMemo(
    () => (stage === 'reading' ? writeReading(topic, question, counselor) : null),
    [stage, topic, question, counselor],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [p, tracked] = await Promise.all([
          api.product(),
          api.trackClick(collectClickSearch()),
        ])
        if (cancelled) return
        setProduct(p)
        setClickId(tracked.click_id)
        setHasCallback(Boolean(tracked.click.has_callback))
        setCallbackPreview(tracked.click.callback_preview || '')
        setAdvertiserId(tracked.click.advertiser_id || '')
        setKsUserId(tracked.click.ks_user_id || '')
      } catch {
        if (!cancelled) setProduct({
          name: '澄室一对一情感咨询',
          price: '9.90',
          list_price: '68.00',
          currency: 'CNY',
          payment_mode: 'sandbox',
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function submitQuestion() {
    setError('')
    setBusy(true)
    try {
      const created = await api.createInquiry({
        click_id: clickId,
        topic,
        question,
        name,
      })
      setInquiryId(created.inquiry_id)
      setStage('matching')
      window.setTimeout(() => setStage('offer'), 2400)
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败')
    } finally {
      setBusy(false)
    }
  }

  async function startPay() {
    if (!inquiryId) return
    if (!agreed) {
      setError('请先阅读并同意服务说明')
      return
    }
    setError('')
    setBusy(true)
    try {
      const created = await api.createOrder(inquiryId)
      setOrderId(created.order_id)
      setPaidAmount(created.order.amount)
      setHasCallback(created.order.has_callback)
      setStage('pay')
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建订单失败')
    } finally {
      setBusy(false)
    }
  }

  async function startConversionTest() {
    setError('')
    setBusy(true)
    setTestMode(true)
    setAgreed(true)
    setTopic('intent')
    setQuestion('联调测试：模拟付费成功后回传快手成交。')
    setName('联调')
    try {
      const tracked = await api.trackClick(collectClickSearch())
      setClickId(tracked.click_id)
      setHasCallback(Boolean(tracked.click.has_callback))
      setCallbackPreview(tracked.click.callback_preview || '')
      setAdvertiserId(tracked.click.advertiser_id || '')
      setKsUserId(tracked.click.ks_user_id || '')
      const created = await api.createInquiry({
        click_id: tracked.click_id,
        topic: 'intent',
        question: '联调测试：模拟付费成功后回传快手成交。',
        name: '联调',
      })
      setInquiryId(created.inquiry_id)
      const order = await api.createOrder(created.inquiry_id)
      setOrderId(order.order_id)
      setPaidAmount(order.order.amount)
      setHasCallback(order.order.has_callback)
      setStage('pay')
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法开始联调')
    } finally {
      setBusy(false)
    }
  }

  async function confirmPay() {
    if (!orderId) return
    setError('')
    setBusy(true)
    try {
      const paid = await api.payOrder(orderId)
      setReport(paid.kuaishou)
      setPaidAmount(paid.order.amount)
      setStage('reading')
    } catch (err) {
      setError(err instanceof Error ? err.message : '支付确认失败')
    } finally {
      setBusy(false)
    }
  }

  async function replayConversion() {
    if (!orderId) return
    setError('')
    setBusy(true)
    try {
      const paid = await api.replayKuaishou(orderId)
      setReport(paid.kuaishou)
    } catch (err) {
      setError(err instanceof Error ? err.message : '重新回传失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="scene">
      <div className="phone">
        <header className="topbar">
          <div className="brand">
            <span className="mark" />
            <div>
              <strong>澄室</strong>
              <em>CLARUM</em>
            </div>
          </div>
          <span className="hours">21:00 – 02:00 夜谈</span>
        </header>
        {debugMode ? (
          <div className={classNames('track-bar', hasCallback ? 'ready' : 'warn')}>
            {hasCallback
              ? `已捕获快手 callback，付费成功后回传 event_type=3${advertiserId ? ` · 账户 ${advertiserId}` : ''}`
              : '未捕获 callback：请从快手视频广告点击进入。当前若仍是 __CALLBACK__，付费后不会上报。'}
          </div>
        ) : null}

        {stage === 'home' && (
          <section className="panel home">
            <div className="hero">
              <img src="/hero-room.jpg" alt="" />
              <div className="hero-copy">
                <p className="eyebrow">EVENING COUNSEL</p>
                <h1>把未说出口的话，交给一个安静的夜晚。</h1>
              </div>
            </div>
            <div className="body">
              <p className="lead">
                澄室是一间一对一情感咨询室。你写下此刻最卡的那件事，咨询师给出结构、边界与下一步——不是算命，也不替你做决定。
              </p>
              <ul className="stats">
                <li>
                  <b>45 分钟</b>
                  <span>书面深谈</span>
                </li>
                <li>
                  <b>3 位</b>
                  <span>驻室咨询师</span>
                </li>
                <li>
                  <b>匿名</b>
                  <span>不留电话</span>
                </li>
              </ul>
              <button className="cta" onClick={() => setStage('compose')}>
                写下心事
              </button>
              {debugMode ? (
                <>
                  <button className="cta ghost" disabled={busy} onClick={startConversionTest}>
                    {busy ? '准备中…' : '测试成交回传'}
                  </button>
                  {error && <p className="err">{error}</p>}
                  <p className="fine">
                    联调页会跳过咨询文案，模拟付费后向快手 track/activate 回传 event_type=3。
                  </p>
                </>
              ) : (
                <>
                  {error && <p className="err">{error}</p>}
                  <p className="fine">从快手视频点进来后，支付成功会自动把付费转化回传到广告后台。</p>
                </>
              )}
            </div>
          </section>
        )}

        {stage === 'compose' && (
          <section className="panel compose">
            <button className="back" onClick={() => setStage('home')}>
              返回
            </button>
            <h2>今晚，你被哪件事停住了？</h2>
            <p className="sub">选择一个方向，再用你自己的句子说清楚。不必留电话。</p>
            <div className="chips">
              {TOPICS.map((item) => (
                <button
                  key={item.id}
                  className={classNames('chip', topic === item.id && 'active')}
                  onClick={() => setTopic(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="field">
              <span>可选署名</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="怎么称呼你（可不填）"
                maxLength={12}
              />
            </label>
            <label className="field">
              <span>心事</span>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="例如：分开两个月了，他还在看我的朋友圈。我该继续等，还是把窗口关掉？"
                rows={6}
                maxLength={280}
              />
              <em>{question.length}/280</em>
            </label>
            {error && <p className="err">{error}</p>}
            <button className="cta" disabled={busy} onClick={submitQuestion}>
              {busy ? '提交中…' : '预约咨询师'}
            </button>
          </section>
        )}

        {stage === 'matching' && (
          <section className="panel matching">
            <div className="moon">
              <img src="/moon-card.jpg" alt="" />
            </div>
            <h2>正在为你安排夜谈</h2>
            <p className="sub">按你写下的主题，匹配最合适的驻室咨询师。</p>
            <div className="pulse" />
          </section>
        )}

        {stage === 'offer' && (
          <section className="panel offer">
            <p className="eyebrow">已为你匹配</p>
            <div className="counselor">
              <div className="avatar">{counselor.name.slice(0, 1)}</div>
              <div>
                <h3>{counselor.name}</h3>
                <p>
                  {counselor.title} · {counselor.years}
                </p>
                <small>{counselor.focus}</small>
              </div>
            </div>
            <blockquote>「{question}」</blockquote>
            <div className="price-card">
              <div>
                <span className="list">¥{product?.list_price || '68.00'}</span>
                <strong>¥{product?.price || '9.90'}</strong>
              </div>
              <p>解锁 {counselor.name} 的书面深谈与行动建议</p>
            </div>
            <label className="agree">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>
                我已阅读并同意《服务说明》与《隐私说明》。本服务为付费咨询，仅供参考，不收集手机号。
              </span>
            </label>
            {error && <p className="err">{error}</p>}
            <button className="cta" disabled={busy} onClick={startPay}>
              {busy ? '正在准备…' : '解锁咨询'}
            </button>
            <p className="fine">支付成功后即开启回复。系统会把本次付费转化回传到快手广告后台。</p>
          </section>
        )}

        {stage === 'pay' && (
          <section className="panel pay">
            <button className="back" onClick={() => setStage(testMode ? 'home' : 'offer')}>
              返回
            </button>
            <h2>完成支付</h2>
            <p className="sub">{product?.name || '澄室一对一情感咨询'}</p>
            <div className="paybox">
              <PayQr seed={orderId || 'clarum'} />
              <div className="amt">
                <small>应付</small>
                <b>¥{paidAmount}</b>
              </div>
              <p>{testMode || debugMode ? '微信支付 · 沙箱联调' : '微信支付'}</p>
            </div>
            {testMode || debugMode ? (
              <ul className="pay-steps">
                <li>客户从快手视频流点击广告，落地页 URL 会带上 callback</li>
                <li>付费成功后服务端 GET track/activate，回传 event_type=3 + 金额</li>
                <li>转化参数只用落地页 callback，不用账户 ID / 快手号</li>
              </ul>
            ) : (
              <p className="sub">支付完成后点下方按钮开通咨询。付费结果会同步到快手广告后台。</p>
            )}
            {error && <p className="err">{error}</p>}
            <button className="cta" disabled={busy} onClick={confirmPay}>
              {busy ? '处理中…' : testMode || debugMode ? '模拟支付成功并回传成交' : '确认支付并开通咨询'}
            </button>
            {testMode || debugMode ? (
              <p className="fine">
                {hasCallback
                  ? `已捕获 callback${ksUserId ? ` · 快手号 ${ksUserId}` : ''}，支付成功后会请求 track/activate。`
                  : '当前没有有效 callback。请用快手视频广告点开落地页（地址栏里 callback 不能是 __CALLBACK__）。'}
              </p>
            ) : null}
          </section>
        )}

        {stage === 'reading' && (
          <section className="panel reading">
            {(() => {
              const verdict = conversionVerdict(report)
              const sent = Boolean(report && !report.skipped)
              const accepted = Boolean(report?.ok && Number(report.kuaishou?.result) === 1)
              const showDebug = testMode || debugMode
              return (
                <>
                  {showDebug ? (
                    <>
                      <p className="eyebrow">付费转化回传</p>
                      <div className={classNames('verdict', verdict.tone)}>
                        <strong>{verdict.title}</strong>
                        <p>{verdict.hint}</p>
                      </div>
                      <ol className="chain">
                        <li className={hasCallback ? 'pass' : 'fail'}>
                          <b>1. 视频点击落地页捕获 callback</b>
                          <span>
                            {hasCallback
                              ? callbackPreview || '已捕获'
                              : '未捕获。请用快手视频广告点开 https://higci01.gxtengsou.cn'}
                          </span>
                        </li>
                        <li className={sent ? 'pass' : 'fail'}>
                          <b>2. 付费后 GET track/activate</b>
                          <span>
                            {report?.skipped
                              ? '已跳过，没有把假 callback 发给快手'
                              : report?.dry_run
                                ? '只生成了链接，未真正请求'
                                : report?.activate_url
                                  ? '已发出转化参数'
                                  : '尚未发出'}
                          </span>
                        </li>
                        <li className={accepted ? 'pass' : sent && report?.ok ? 'pass' : 'fail'}>
                          <b>3. 快手广告后台确认</b>
                          <span>
                            {accepted
                              ? 'result=1，后台已接收 event_type=3 付费'
                              : report?.kuaishou
                                ? `返回 ${JSON.stringify(report.kuaishou)}`
                                : report?.error_msg || '尚无快手返回'}
                          </span>
                        </li>
                      </ol>
                      <div className={classNames('report', verdict.tone === 'ok' && 'ok', verdict.tone === 'skip' && 'skip')}>
                        <h4>回传给快手的转化参数</h4>
                        <dl>
                          <div>
                            <dt>event_type</dt>
                            <dd>{report?.event_type ?? 3} · 付费</dd>
                          </div>
                          <div>
                            <dt>purchase_amount</dt>
                            <dd>{report?.purchase_amount || paidAmount}</dd>
                          </div>
                          <div>
                            <dt>event_time</dt>
                            <dd>{report?.event_time ?? '—'}</dd>
                          </div>
                          <div>
                            <dt>callback</dt>
                            <dd>{callbackPreview || '无'}</dd>
                          </div>
                          {advertiserId ? (
                            <div>
                              <dt>advertiser_id</dt>
                              <dd>{advertiserId}（仅对账）</dd>
                            </div>
                          ) : null}
                          {ksUserId ? (
                            <div>
                              <dt>ks_user_id</dt>
                              <dd>{ksUserId}（仅对账）</dd>
                            </div>
                          ) : null}
                          {report?.http_status ? (
                            <div>
                              <dt>HTTP</dt>
                              <dd>{report.http_status}</dd>
                            </div>
                          ) : null}
                        </dl>
                        {report?.activate_url ? (
                          <>
                            <span className="label">实际请求</span>
                            <code className="activate">{report.activate_url}</code>
                          </>
                        ) : null}
                        {report?.kuaishou ? (
                          <>
                            <span className="label">快手原始返回</span>
                            <code className="activate">{JSON.stringify(report.kuaishou)}</code>
                          </>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="eyebrow">咨询已开通</p>
                      <div className={classNames('verdict', accepted ? 'ok' : 'skip')}>
                        <strong>{accepted ? '支付成功，夜谈已开始' : '支付成功'}</strong>
                        <p>
                          {accepted
                            ? '本次付费已同步到快手广告后台。'
                            : hasCallback
                              ? '咨询内容如下。投放转化正在同步。'
                              : '咨询内容如下。'}
                        </p>
                      </div>
                    </>
                  )}
                  {error && <p className="err">{error}</p>}
                  {showDebug ? (
                    <button className="cta" disabled={busy} onClick={replayConversion}>
                      {busy ? '回传中…' : '重新向快手回传成交'}
                    </button>
                  ) : null}
                  <button
                    className="cta ghost"
                    onClick={() => {
                      setStage('home')
                      setReport(null)
                      setTestMode(false)
                    }}
                  >
                    返回首页
                  </button>
                  {reading && !testMode ? (
                    <div className="practice">
                      <span>咨询摘要</span>
                      <p>
                        {reading.close}：{reading.lead}
                      </p>
                    </div>
                  ) : null}
                </>
              )
            })()}
          </section>
        )}

        <footer className="foot">
          <img src="/gold-texture.jpg" alt="" />
          <p>澄室 Clarum · 匿名夜谈</p>
          <p>不收集电话号码 · 付费成功后向快手广告后台回传转化</p>
        </footer>
      </div>

      <aside className="rail">
        <p className="eyebrow">Studio</p>
        <h2>一间只在夜里开门的咨询室。</h2>
        <ul>
          {COUNSELORS.map((c) => (
            <li key={c.id}>
              <b>{c.name}</b>
              <span>
                {c.title} / {c.focus}
              </span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
