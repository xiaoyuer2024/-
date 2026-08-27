import { useEffect, useMemo, useState } from 'react'
import { api, type KuaishouReport, type Product } from './lib/api'
import { COUNSELORS, TOPICS, matchCounselor, writeReading } from './lib/reading'

type Stage = 'home' | 'compose' | 'matching' | 'offer' | 'pay' | 'reading'

function classNames(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(' ')
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
          api.trackClick(window.location.search),
        ])
        if (cancelled) return
        setProduct(p)
        setClickId(tracked.click_id)
        setHasCallback(Boolean(tracked.click.has_callback))
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
              <p className="fine">服务仅供自我觉察与情绪梳理参考，不构成心理治疗或任何决策依据。</p>
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
            <p className="fine">支付成功后即开启回复。投放归因仅在服务端回传付费事件。</p>
          </section>
        )}

        {stage === 'pay' && (
          <section className="panel pay">
            <button className="back" onClick={() => setStage('offer')}>
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
              <p>微信支付 · 沙箱联调</p>
            </div>
            <ul className="pay-steps">
              <li>正式环境将拉起微信/支付宝收银台</li>
              <li>成功以支付通道异步通知为准</li>
              <li>随后由服务端回传快手付费事件（event_type = 3）</li>
            </ul>
            {error && <p className="err">{error}</p>}
            <button className="cta" disabled={busy} onClick={confirmPay}>
              {busy ? '确认中…' : '模拟支付成功'}
            </button>
            <p className="fine">
              {hasCallback ? '已捕获本次点击的 callback，支付后将用于回传。' : '当前链接没有有效 callback，回传会被跳过（避免伪造）。'}
            </p>
          </section>
        )}

        {stage === 'reading' && reading && (
          <section className="panel reading">
            <p className="eyebrow">咨询已解锁</p>
            <h2>{reading.close}</h2>
            <p className="lead">{reading.lead}</p>
            {reading.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <div className="practice">
              <span>今晚的练习</span>
              <p>{reading.practice}</p>
            </div>
            <div className={classNames('report', report?.ok && !report.skipped && 'ok', report?.skipped && 'skip')}>
              <h4>快手付费回传</h4>
              <p>
                {report?.skipped
                  ? '未回传：缺少真实 callback（宏未替换或未拼接）。'
                  : report?.dry_run
                    ? '已生成回传请求，当前为演练模式，未真正请求快手。'
                    : report?.ok
                      ? '已向快手上报支付成功。'
                      : '回传未成功，请查看服务端日志。'}
              </p>
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
              </dl>
            </div>
            <p className="fine">以上文本为结构化咨询回应，仅供自我觉察参考。</p>
          </section>
        )}

        <footer className="foot">
          <img src="/gold-texture.jpg" alt="" />
          <p>澄室 Clarum · 匿名夜谈</p>
          <p>不收集电话号码 · 支付成功后回传快手付费转化</p>
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
