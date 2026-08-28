# 澄室 Clarum

一对一情感咨询落地页。支付成功后由服务端向快手线索类接口回传 **付费成交**（`event_type=3`）。

线上域名：`https://higci01.gxtengsou.cn`

## 填到快手广告后台的落地页链接

把下面这一整段贴进磁力引擎落地页（`callback=__CALLBACK__` 必带，快手点击后会替换成真实值）：

```
https://higci01.gxtengsou.cn/?click_type=kuaishou&advertiser_id=121460078&ks_user_id=5712746951&ip=__IP__&ts=__TS__&ua=__UA__&os=__OS__&cid=__CID__&csite=__CSITE__&oaid=__OAID2__&imei_md5=__IMEI2__&android_id_md5=__ANDROIDID2__&idfa=__IDFA2__&callback=__CALLBACK__
```

点开广告后，地址栏里的 `callback=` 必须变成一长串，不能还是 `__CALLBACK__`。

## 付费成功后回传快手广告后台的链接

服务端在支付成功时请求（`callback` 用点击后落地页上的真实值，不要用账户 ID 或快手号）：

```
https://ad.partner.gifshow.com/track/activate?callback={点击后的真实callback}&event_type=3&event_time={13位毫秒时间戳}&purchase_amount=9.90
```

模板示意（`__CALLBACK__` 仅表示占位，联调时必须已替换）：

```
https://ad.partner.gifshow.com/track/activate?callback=__CALLBACK__&event_type=3&event_time=1787803507617&purchase_amount=9.90
```

| 参数 | 含义 |
|---|---|
| callback | 落地页上快手下发的点击标识，必填 |
| event_type | `3` = 付费成交 |
| event_time | 支付成功时刻（13 位毫秒） |
| purchase_amount | 实付 `9.90` |

`advertiser_id=121460078`、`ks_user_id=5712746951` 只用于你们自己对账，不要接到 `track/activate` 上。

## 上传到服务器测试

```bash
cd consult
npm install
npm run pack
```

生成 `clarum-kuaishou-upload.zip`。解压后把 `index.html`、`api.php`、`assets/`、`data/` 放到 `https://higci01.gxtengsou.cn/` 网站根目录。需要 PHP 7.4+（开启 curl），并把 `data` 设为可写。先打开 `/check.html` 确认接口 `ok: true`。

## 本地运行

```bash
cd consult
cp .env.example .env
npm install
npm test
npm run dev
```

`KUAISHOU_DRY_RUN=false` 时，只要 callback 有效就会真正请求快手。callback 无效时不会伪造回传。
