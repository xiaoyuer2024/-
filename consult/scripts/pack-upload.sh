#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="/tmp/clarum-kuaishou-upload"
ZIP="/opt/cursor/artifacts/clarum-kuaishou-upload.zip"
CN_ZIP="/opt/cursor/artifacts/clarum-kuaishou-upload-cn.zip"
REPO_ZIP="$ROOT/../clarum-kuaishou-upload.zip"

cd "$ROOT"

echo "build PHP-hosted frontend (api.php)"
VITE_API_PREFIX=/api.php npm run build

rm -rf "$OUT"
mkdir -p "$OUT/data" "$OUT/node-server/server" "$OUT/node-server/dist"
cp -a dist/. "$OUT/"
cp hosting/api.php "$OUT/api.php"
cp hosting/.htaccess "$OUT/.htaccess"
cp hosting/nginx.conf.example "$OUT/nginx.conf.example"
cp hosting/使用说明.txt "$OUT/使用说明.txt"
cp hosting/check.html "$OUT/check.html"
cp hosting/data/.htaccess "$OUT/data/.htaccess"
printf '' > "$OUT/data/.keep"
chmod 777 "$OUT/data"

echo "build Node-hosted frontend (/api)"
VITE_API_PREFIX=/api npm run build
cp hosting/node-package.json "$OUT/node-server/package.json"
cp server/index.mjs server/kuaishou.mjs "$OUT/node-server/server/"
cp -a dist/. "$OUT/node-server/dist/"
cat > "$OUT/node-server/.env" << 'ENV'
PAYMENT_MODE=sandbox
KUAISHOU_DRY_RUN=false
KUAISHOU_ACTIVATE_URL=https://ad.partner.gifshow.com/track/activate
PRODUCT_PRICE=9.90
PRODUCT_LIST_PRICE=68.00
PRODUCT_NAME=澄室一对一情感咨询
PORT=8787
ENV

rm -f "$ZIP" "$CN_ZIP" "$REPO_ZIP"
python3 - << PY
import os, zipfile, shutil
out = "$OUT"
zip_paths = ["$ZIP", "$REPO_ZIP", "$CN_ZIP"]
files = []
for root, dirs, names in os.walk(out):
    for name in names:
        files.append(os.path.join(root, name))
for zp in zip_paths:
    parent = os.path.dirname(os.path.abspath(zp))
    os.makedirs(parent, exist_ok=True)
    with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
        for path in files:
            z.write(path, os.path.relpath(path, out))
    print("wrote", zp, os.path.getsize(zp))
PY

# Chinese filename copy for easier download
CN_NAME="/opt/cursor/artifacts/chengshi-kuaishou-upload.zip"
cp -f "$ZIP" "$CN_NAME"
cp -f "$ZIP" "$REPO_ZIP"

echo "package ready"
ls -lh "$ZIP" "$REPO_ZIP" "$CN_NAME"
