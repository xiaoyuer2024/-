import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractCallback,
  parseClickQuery,
  buildActivateUrl,
  reportPaySuccess,
  EVENT_PAY_SUCCESS,
} from './kuaishou.mjs'

describe('extractCallback', () => {
  it('returns a raw token', () => {
    assert.equal(extractCallback('DHAJASALKFyk1uCKBYCyXp'), 'DHAJASALKFyk1uCKBYCyXp')
  })

  it('rejects macros and empty values', () => {
    assert.equal(extractCallback('__CALLBACK__'), null)
    assert.equal(extractCallback('__IP__'), null)
    assert.equal(extractCallback(''), null)
    assert.equal(extractCallback(null), null)
  })

  it('pulls callback out of a full activate URL', () => {
    const raw =
      'https://ad.partner.gifshow.com/track/activate?callback=RealToken123&event_type=1'
    assert.equal(extractCallback(raw), 'RealToken123')
  })

  it('decodes a once-encoded activate URL', () => {
    const encoded = encodeURIComponent(
      'http://ad.partner.gifshow.com/track/activate?callback=EncodedToken',
    )
    assert.equal(extractCallback(encoded), 'EncodedToken')
  })
})

describe('parseClickQuery', () => {
  it('reads the Kuaishou landing macros used by the reference URL', () => {
    const q =
      'click_type=kuaishou&ip=__IP__&ts=__TS__&ua=__UA__&os=__OS__&cid=888&csite=1&oaid=__OAID2__&imei_md5=__IMEI2__&android_id_md5=__ANDROIDID2__&idfa=__IDFA2__&callback=LiveCallbackToken'
    const parsed = parseClickQuery(q)
    assert.equal(parsed.click_type, 'kuaishou')
    assert.equal(parsed.cid, '888')
    assert.equal(parsed.callback, 'LiveCallbackToken')
    assert.equal(parsed.ip, '__IP__')
  })

  it('reads advertiser and kuaishou ids without treating an unreplaced callback as valid', () => {
    const q =
      'click_type=kuaishou&advertiser_id=121460078&ks_user_id=5712746951&callback=__CALLBACK__'
    const parsed = parseClickQuery(q)
    assert.equal(parsed.advertiser_id, '121460078')
    assert.equal(parsed.ks_user_id, '5712746951')
    assert.equal(parsed.callback, null)
  })
})

describe('buildActivateUrl', () => {
  it('builds the official pay-success query', () => {
    const url = buildActivateUrl({
      callback: 'Tok',
      eventType: EVENT_PAY_SUCCESS,
      eventTime: 1536045380000,
      purchaseAmount: 9.9,
    })
    assert.equal(
      url,
      'https://ad.partner.gifshow.com/track/activate?callback=Tok&event_type=3&event_time=1536045380000&purchase_amount=9.90',
    )
  })
})

describe('reportPaySuccess', () => {
  it('skips live calls when callback is missing', async () => {
    const result = await reportPaySuccess({
      callback: '__CALLBACK__',
      purchaseAmount: 9.9,
      dryRun: false,
    })
    assert.equal(result.skipped, true)
    assert.equal(result.reason, 'missing_or_placeholder_callback')
  })

  it('does not hit Kuaishou in dry-run mode', async () => {
    let called = false
    const result = await reportPaySuccess({
      callback: 'Tok',
      purchaseAmount: 9.9,
      eventTime: 111,
      dryRun: true,
      fetchImpl: async () => {
        called = true
        return new Response('{}')
      },
    })
    assert.equal(called, false)
    assert.equal(result.dry_run, true)
    assert.equal(result.event_type, 3)
    assert.match(result.activate_url, /event_type=3/)
    assert.match(result.activate_url, /purchase_amount=9.90/)
  })

  it('GETs the activate endpoint on a real report', async () => {
    const result = await reportPaySuccess({
      callback: 'Tok',
      purchaseAmount: '9.90',
      eventTime: 222,
      dryRun: false,
      fetchImpl: async (url) => {
        assert.match(String(url), /callback=Tok/)
        return new Response(JSON.stringify({ result: 1 }), { status: 200 })
      },
    })
    assert.equal(result.ok, true)
    assert.equal(result.kuaishou.result, 1)
  })
})
