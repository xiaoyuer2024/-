# 澄室 Clarum

一对一情感咨询落地页。支付成功后由服务端向快手线索类接口回传 **付费成交**（`event_type=3`）。

## 快手投放链接

监测宏必须带 `callback`。账户 ID、快手号只作你们自己对账，不会传给 `track/activate`。

```
https://可公网访问的域名/?click_type=kuaishou&advertiser_id=121460078&ks_user_id=5712746951&callback=__CALLBACK__
```

注意：快手 App 打不开 `localhost`。联调请用公网域名或快手后台的点击监测预览（打开后地址栏里 `callback` 必须已被替换，不能仍是 `__CALLBACK__`）。

## 测试付费成功后回传什么

服务端 GET：

```
https://ad.partner.gifshow.com/track/activate?callback={点击后的真实callback}&event_type=3&event_time={13位毫秒}&purchase_amount=9.90
```

| 参数 | 含义 |
|---|---|
| callback | 落地页上快手下发的点击标识，必填 |
| event_type | `3` = 付费成交 |
| event_time | 支付成功时刻 |
| purchase_amount | 实付 `9.90` |

页面顶部会显示是否已捕获 callback。点「模拟支付成功并回传成交」后，结果卡会展示快手 `result` 和实际请求 URL。

## 本地运行

```bash
cd consult
cp .env.example .env
npm install
npm test
npm run dev
```

`KUAISHOU_DRY_RUN=false` 时，只要 callback 有效就会真正请求快手。callback 无效时不会伪造回传。
