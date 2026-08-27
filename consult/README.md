# 澄室 Clarum

一对一情感咨询落地页。参考快手投放页的「提问 → 咨询 → 支付解锁」路径，**不收集电话号码**；支付成功后由服务端按快手**线索类 API**回传付费事件。

文案、视觉与品牌均为原创，不复用第三方素材。

## 用户路径

1. 写下心事（主题 + 文本，可匿名，无手机号）
2. 匹配驻室咨询师
3. 支付解锁书面深谈
4. 服务端回传快手 `event_type=3`（付费）与实付金额

## 快手投放链接

在磁力引擎填写落地页时，保留监测宏。快手点击后会把宏替换成真实值，并通常自动拼接 `callback`。

```
https://你的域名/?click_type=kuaishou&ip=__IP__&ts=__TS__&ua=__UA__&os=__OS__&cid=__CID__&csite=__CSITE__&oaid=__OAID2__&imei_md5=__IMEI2__&android_id_md5=__ANDROIDID2__&idfa=__IDFA2__&callback=__CALLBACK__
```

支付成功后的回传（线索类转化接口）：

```
GET https://ad.partner.gifshow.com/track/activate
  ?callback={落地页保存的完整 callback}
  &event_type=3
  &event_time={13位毫秒时间戳}
  &purchase_amount={实付金额，两位小数}
```

`callback` 必须是快手下发的原值。未替换的 `__CALLBACK__`、空值或自造值不会被上报。

## 本地运行

```bash
cd consult
cp .env.example .env
npm install
npm test
npm run dev
```

浏览器打开 `http://localhost:5174`。

默认 `PAYMENT_MODE=sandbox` 且 `KUAISHOU_DRY_RUN=true`：可走通支付，但只生成回传 URL，不请求快手。联调时用真实点击打开页面，确认已捕获 callback 后，再设 `KUAISHOU_DRY_RUN=false`。

正式环境请把沙箱支付替换为微信/支付宝异步通知，并在验签成功后调用同一套回传逻辑。
