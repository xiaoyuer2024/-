<?php
ob_start();
@ini_set('display_errors', '0');
@ini_set('html_errors', '0');
@ini_set('log_errors', '1');
error_reporting(0);

const PRICE = '9.90';
const LIST_PRICE = '68.00';
const PRODUCT_NAME = '澄室一对一情感咨询';
const ACTIVATE_URL = 'https://ad.partner.gifshow.com/track/activate';
const EVENT_PAY = 3;

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$body = read_body();
$path = request_path($body);

if ($method === 'OPTIONS') {
    json_out(new stdClass(), 204);
}

try {
    dispatch($method, $path, $body);
    json_out(['success' => false, 'code' => 404, 'message' => '请求的资源不存在', 'path' => $path], 404);
} catch (Throwable $e) {
    json_out(['ok' => false, 'message' => '接口异常：' . $e->getMessage()], 500);
}

function request_path($body) {
    $act = '';
    foreach (['act', 'r', 'route'] as $key) {
        if (!empty($_GET[$key])) {
            $act = (string)$_GET[$key];
            break;
        }
    }
    if ($act === '' && is_array($body)) {
        foreach (['_act', 'act', '_r', 'r'] as $key) {
            if (!empty($body[$key])) {
                $act = (string)$body[$key];
                break;
            }
        }
    }

    $id = $_GET['id'] ?? ($body['_id'] ?? ($body['order_id'] ?? ''));
    $mapped = map_act($act, (string)$id);
    if ($mapped) return $mapped;

    $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $uri = is_string($uri) ? $uri : '/';

    if (preg_match('#/api\.php(/.*)$#', $uri, $m)) {
        return '/api' . rtrim($m[1], '/');
    }

    $pathInfo = $_SERVER['PATH_INFO'] ?? '';
    if ($pathInfo) {
        $info = '/' . ltrim($pathInfo, '/');
        return '/api' . rtrim($info === '/' ? '' : $info, '/');
    }

    if (preg_match('#(/api(?:/.*)?)$#', $uri, $m)) {
        $trimmed = rtrim($m[1], '/');
        return $trimmed === '' ? '/api' : $trimmed;
    }

    return rtrim($uri, '/') ?: '/';
}

function map_act($act, $id) {
    $raw = trim((string)$act);
    if ($raw === '') return '';
    $raw = str_replace('\\', '/', $raw);
    $key = strtolower(ltrim($raw, '/'));
    $key = preg_replace('#^api/#', '', $key);
    $key = str_replace('/', '.', $key);
    $key = str_replace('-', '_', $key);

    $table = [
        'health' => '/api/health',
        'product' => '/api/product',
        'track' => '/api/track/click',
        'track.click' => '/api/track/click',
        'track_click' => '/api/track/click',
        'inquiries' => '/api/inquiries',
        'orders' => '/api/orders',
        'order_pay' => '/api/orders/{id}/pay',
        'orders.pay' => '/api/orders/{id}/pay',
        'order_replay' => '/api/orders/{id}/replay-kuaishou',
        'orders.replay_kuaishou' => '/api/orders/{id}/replay-kuaishou',
        'replay_kuaishou' => '/api/orders/{id}/replay-kuaishou',
    ];

    if (isset($table[$key])) {
        return str_replace('{id}', $id, $table[$key]);
    }

    if (preg_match('#^orders\.([a-f0-9-]+)\.(pay|replay_kuaishou)$#', $key, $m)) {
        $action = $m[2] === 'pay' ? 'pay' : 'replay-kuaishou';
        return "/api/orders/{$m[1]}/{$action}";
    }

    if ($raw[0] === '/' || strpos($raw, '/api') !== false) {
        $r = '/' . ltrim($raw, '/');
        if (strpos($r, '/api') !== 0) $r = '/api' . $r;
        $trimmed = rtrim($r, '/');
        return $trimmed === '' ? '/api' : $trimmed;
    }

    return '';
}

function json_out($data, $code = 200) {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
    }
    http_response_code($code);
    if ($code === 204) {
        exit;
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function read_body() {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function uid() {
    try {
        return bin2hex(random_bytes(16));
    } catch (Exception $e) {
        return md5(uniqid((string)mt_rand(), true));
    }
}

function empty_store() {
    return ['clicks' => [], 'inquiries' => [], 'orders' => []];
}

function data_candidates() {
    $tmp = rtrim(sys_get_temp_dir(), '/\\');
    return [
        __DIR__ . '/data/store.php',
        __DIR__ . '/clarum-store.php',
        $tmp . '/clarum-store.php',
    ];
}

function data_file() {
    static $chosen = null;
    if ($chosen) return $chosen;
    foreach (data_candidates() as $file) {
        $dir = dirname($file);
        if (!is_dir($dir)) {
            @mkdir($dir, 0777, true);
        }
        @chmod($dir, 0777);
        if (is_file($file) && is_readable($file)) {
            $chosen = $file;
            return $chosen;
        }
        if (is_dir($dir) && is_writable($dir)) {
            $probe = $dir . '/.clarum-write';
            if (@file_put_contents($probe, '1') !== false) {
                @unlink($probe);
                $chosen = $file;
                return $chosen;
            }
        }
    }
    $chosen = data_candidates()[0];
    return $chosen;
}

function load_store() {
    foreach (data_candidates() as $file) {
        if (is_file($file)) {
            $data = @include $file;
            if (is_array($data)) return $data;
        }
    }
    $legacy = __DIR__ . '/data/store.json';
    if (is_file($legacy)) {
        $json = json_decode((string)@file_get_contents($legacy), true);
        if (is_array($json)) return $json;
    }
    return empty_store();
}

function save_store($store) {
    $file = data_file();
    $dir = dirname($file);
    if (!is_dir($dir)) {
        @mkdir($dir, 0777, true);
    }
    @chmod($dir, 0777);
    $export = var_export($store, true);
    $ok = @file_put_contents($file, "<?php\nreturn {$export};\n", LOCK_EX);
    if ($ok === false) {
        json_out(['ok' => false, 'message' => 'data 目录不可写。请在网站根目录执行 chmod -R 777 data'], 500);
    }
}

function data_writable() {
    $file = data_file();
    $dir = dirname($file);
    if (!is_dir($dir)) @mkdir($dir, 0777, true);
    $probe = $dir . '/.clarum-write';
    $ok = @file_put_contents($probe, '1');
    if ($ok === false) return false;
    @unlink($probe);
    return true;
}

function str_len($value) {
    return function_exists('mb_strlen') ? mb_strlen((string)$value, 'UTF-8') : strlen((string)$value);
}

function is_macro($value) {
    return !$value || preg_match('/^__+[A-Z0-9]+_*__$/i', trim((string)$value));
}

function extract_callback($raw) {
    if ($raw === null) return null;
    $trimmed = trim((string)$raw);
    if ($trimmed === '' || is_macro($trimmed)) return null;
    if (preg_match('#^https?://#i', $trimmed)) {
        $q = parse_url($trimmed, PHP_URL_QUERY);
        parse_str($q ?: '', $params);
        $cb = $params['callback'] ?? $params['CALLBACK'] ?? '';
        return is_macro($cb) ? null : ($cb ?: null);
    }
    if (stripos($trimmed, '%3A%2F%2F') !== false) {
        $decoded = urldecode($trimmed);
        if (preg_match('#^https?://#i', $decoded)) {
            return extract_callback($decoded);
        }
    }
    return $trimmed;
}

function parse_click_query($search) {
    $q = ltrim((string)$search, '?');
    parse_str($q, $params);
    $get = function (...$keys) use ($params) {
        foreach ($keys as $key) {
            if (!empty($params[$key])) return (string)$params[$key];
        }
        return '';
    };
    return [
        'callback' => extract_callback($get('callback', 'CALLBACK')),
        'click_type' => $get('click_type'),
        'advertiser_id' => $get('advertiser_id', 'account_id'),
        'ks_user_id' => $get('ks_user_id', 'kid', 'kuaishou_id'),
        'ip' => $get('ip'),
        'cid' => $get('cid'),
        'csite' => $get('csite'),
    ];
}

function callback_preview($token) {
    if (!$token) return '';
    $len = strlen($token);
    return substr($token, 0, 10) . '…' . substr($token, -6) . "（{$len}字）";
}

function public_click($click) {
    if (!is_array($click)) return null;
    $token = $click['callback'] ?? '';
    return [
        'id' => $click['id'] ?? '',
        'has_callback' => (bool)$token,
        'callback_preview' => callback_preview($token),
        'click_type' => $click['click_type'] ?? '',
        'advertiser_id' => $click['advertiser_id'] ?? '',
        'ks_user_id' => $click['ks_user_id'] ?? '',
        'cid' => $click['cid'] ?? '',
        'created_at' => $click['created_at'] ?? '',
    ];
}

function http_get($url) {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $text = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        return [$text, $status, $err];
    }

    $ctx = stream_context_create([
        'http' => ['timeout' => 8, 'ignore_errors' => true],
        'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
    ]);
    $text = @file_get_contents($url, false, $ctx);
    $status = 0;
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
        $status = (int)$m[1];
    }
    return [$text, $status, $text === false ? '回传请求失败（未安装 curl，且 allow_url_fopen 不可用）' : ''];
}

function report_pay($callback, $amount) {
    $token = extract_callback($callback);
    $eventTime = (int) round(microtime(true) * 1000);
    $purchase = number_format((float)$amount, 2, '.', '');
    if (!$token) {
        return [
            'ok' => false,
            'skipped' => true,
            'reason' => 'missing_or_placeholder_callback',
            'event_type' => EVENT_PAY,
            'message' => '落地页 callback 仍是 __CALLBACK__ 或为空。请从快手广告真实点击进入后再测付费。',
        ];
    }
    $url = ACTIVATE_URL . '?' . http_build_query([
        'callback' => $token,
        'event_type' => EVENT_PAY,
        'event_time' => $eventTime,
        'purchase_amount' => $purchase,
    ]);
    list($text, $status, $err) = http_get($url);
    if ($text === false) {
        return [
            'ok' => false,
            'dry_run' => false,
            'skipped' => false,
            'event_type' => EVENT_PAY,
            'event_time' => $eventTime,
            'purchase_amount' => $purchase,
            'activate_url' => $url,
            'error_msg' => $err ?: '回传请求失败',
        ];
    }
    $parsed = json_decode($text, true);
    if (!is_array($parsed)) $parsed = ['raw' => $text];
    $decodedFailed = stripos((string)$text, 'callbackinfo decoded') !== false;
    $resultOk = isset($parsed['result']) && (int)$parsed['result'] === 1;
    $illegal = isset($parsed['error_msg']) ? (string)$parsed['error_msg'] : null;
    return [
        'ok' => $status >= 200 && $status < 300 && !$decodedFailed && ($resultOk || !isset($parsed['result'])),
        'dry_run' => false,
        'skipped' => false,
        'event_type' => EVENT_PAY,
        'event_time' => $eventTime,
        'purchase_amount' => $purchase,
        'activate_url' => $url,
        'http_status' => $status,
        'kuaishou' => $parsed,
        'error_msg' => $decodedFailed
            ? 'callbackinfo decoded failure：callback 不是快手点击下发的原值'
            : ($resultOk ? null : $illegal),
    ];
}

function lookup_click($store, $inquiry) {
    if (!is_array($inquiry)) return null;
    $clickId = $inquiry['click_id'] ?? null;
    if (!$clickId) return null;
    $click = $store['clicks'][$clickId] ?? null;
    return is_array($click) ? $click : null;
}

function dispatch($method, $path, $body) {
    if ($method === 'GET' && $path === '/api/health') {
        json_out([
            'ok' => true,
            'product' => PRODUCT_NAME,
            'price' => PRICE,
            'list_price' => LIST_PRICE,
            'payment_mode' => 'sandbox',
            'kuaishou_dry_run' => false,
            'kuaishou_event_type' => EVENT_PAY,
            'kuaishou_event_name' => '付费成交',
            'hosting' => 'php',
            'data_writable' => data_writable(),
            'data_file' => basename(dirname(data_file())) . '/' . basename(data_file()),
        ]);
    }

    if ($method === 'GET' && $path === '/api/product') {
        json_out([
            'name' => PRODUCT_NAME,
            'price' => PRICE,
            'list_price' => LIST_PRICE,
            'currency' => 'CNY',
            'payment_mode' => 'sandbox',
        ]);
    }

    $store = load_store();

    if ($method === 'POST' && $path === '/api/track/click') {
        $parsed = parse_click_query($body['search'] ?? '');
        $id = uid();
        $click = array_merge(['id' => $id, 'page_url' => $body['page_url'] ?? '', 'created_at' => gmdate('c')], $parsed);
        $store['clicks'][$id] = $click;
        save_store($store);
        json_out(['click_id' => $id, 'click' => public_click($click)]);
    }

    if ($method === 'POST' && $path === '/api/inquiries') {
        if (!empty($body['phone'])) json_out(['ok' => false, 'message' => '本咨询不收集电话号码'], 400);
        $question = trim($body['question'] ?? '');
        if (str_len($question) < 8) json_out(['ok' => false, 'message' => '请把心事写得更具体一些（至少 8 个字）'], 400);
        $id = uid();
        $inquiry = [
            'id' => $id,
            'click_id' => $body['click_id'] ?? null,
            'topic' => $body['topic'] ?? '',
            'name' => trim($body['name'] ?? '') ?: '匿名来访者',
            'question' => $question,
            'created_at' => gmdate('c'),
        ];
        $store['inquiries'][$id] = $inquiry;
        save_store($store);
        json_out(['inquiry_id' => $id, 'inquiry' => $inquiry]);
    }

    if ($method === 'POST' && $path === '/api/orders') {
        $inquiry = $store['inquiries'][$body['inquiry_id'] ?? ''] ?? null;
        if (!$inquiry) json_out(['ok' => false, 'message' => '咨询单不存在'], 404);
        $click = lookup_click($store, $inquiry);
        $id = uid();
        $order = [
            'id' => $id,
            'inquiry_id' => $inquiry['id'],
            'click_id' => $inquiry['click_id'] ?? null,
            'amount' => PRICE,
            'status' => 'pending',
            'created_at' => gmdate('c'),
            'paid_at' => null,
            'kuaishou' => null,
        ];
        $store['orders'][$id] = $order;
        save_store($store);
        json_out([
            'order_id' => $id,
            'order' => array_merge($order, [
                'product_name' => PRODUCT_NAME,
                'list_price' => LIST_PRICE,
                'payment_mode' => 'sandbox',
                'has_callback' => is_array($click) && !empty($click['callback']),
                'advertiser_id' => is_array($click) ? (string)($click['advertiser_id'] ?? '') : '',
                'ks_user_id' => is_array($click) ? (string)($click['ks_user_id'] ?? '') : '',
            ]),
        ]);
    }

    if (preg_match('#^/api/orders/([a-f0-9-]+)$#', $path, $m) && $method === 'GET') {
        $order = $store['orders'][$m[1]] ?? null;
        if (!$order) json_out(['ok' => false, 'message' => '订单不存在'], 404);
        json_out(['order' => $order, 'inquiry' => $store['inquiries'][$order['inquiry_id']] ?? null]);
    }

    if (preg_match('#^/api/orders/([a-f0-9-]+)/(pay|replay-kuaishou)$#', $path, $m) && $method === 'POST') {
        $id = $m[1];
        $action = $m[2];
        $order = $store['orders'][$id] ?? null;
        if (!$order) json_out(['ok' => false, 'message' => '订单不存在'], 404);
        if ($action === 'replay-kuaishou' && ($order['status'] ?? '') !== 'paid') {
            json_out(['ok' => false, 'message' => '请先完成模拟支付'], 400);
        }
        if ($action === 'pay' && ($order['status'] ?? '') === 'paid') {
            json_out(['ok' => true, 'order' => $order, 'kuaishou' => $order['kuaishou'], 'idempotent' => true]);
        }
        $inquiry = $store['inquiries'][$order['inquiry_id'] ?? ''] ?? null;
        $click = lookup_click($store, is_array($inquiry) ? $inquiry : []);
        $kuaishou = report_pay(is_array($click) ? ($click['callback'] ?? null) : null, $order['amount']);
        if ($action === 'pay') {
            $order['status'] = 'paid';
            $order['paid_at'] = gmdate('c');
        }
        $order['kuaishou'] = $kuaishou;
        $store['orders'][$id] = $order;
        save_store($store);
        json_out([
            'ok' => true,
            'order' => $order,
            'inquiry' => $inquiry,
            'kuaishou' => $kuaishou,
            'click' => public_click($click),
        ]);
    }
}
