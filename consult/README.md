# 澄室 Clarum

一对一情感咨询落地页。客户从快手视频流点击广告进入本页，付费成功后由服务端把转化参数回传到快手广告后台。

依据：[H5落地页类广告转化数据API](https://docs.qingque.cn/d/home/eZQCZzmIhUFUUpOOBlfg5kbYI)（信息流 H5）。

线上域名：`https://higci01.gxtengsou.cn`

## 填到快手广告后台的落地页链接

视频流 / 信息流 H5 投放，把下面整段贴进磁力引擎落地页。`callback=__CALLBACK__` 必带；用户从视频点进来后，快手会把它替换成真实 callback。

```
https://higci01.gxtengsou.cn/?utm_source=kuaishou&advertiser_id=121460078&ks_user_id=5712746951&aid=__AID__&cid=__CID__&did=__DID__&dname=__Dname__&callback=__CALLBACK__
```

点开广告后，地址栏里的 `callback=` 必须变成一长串，不能还是 `__CALLBACK__`。

联调页（投放同学）：`https://higci01.gxtengsou.cn/?debug=1`

## 付费成功后回传快手广告后台

服务端在支付成功时 GET（`callback` 用点击后落地页上的真实值）：

```
https://ad.partner.gifshow.com/track/activate?callback={点击后的真实callback}&event_type=3&event_time={13位毫秒时间戳}&purchase_amount=9.90
```

| 参数 | 含义 |
|---|---|
| callback | 视频点击后落地页上的广告 ID，必填 |
| event_type | `3` = 付费（官方信息流 H5 付费事件） |
| event_time | 支付成功时刻（13 位毫秒） |
| purchase_amount | 实付金额，单位元，两位小数 |

快手返回 `{"result":1}` 表示广告后台已接收这笔转化。`advertiser_id`、`ks_user_id` 只用于对账，不要接到 `track/activate` 上。

## 上传到服务器

```bash
cd consult
npm install
npm run pack
```

把 `clarum-kuaishou-upload.zip` 解压到网站根目录，`chmod -R 777 data`，先打开 `/check.html`。

## 本地运行

```bash
cd consult
cp .env.example .env
npm install
npm test
npm run dev
```
