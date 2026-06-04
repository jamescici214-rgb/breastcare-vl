# ============================================================
# BreastCare-VL 命名隧道一次性配置脚本
# 作用：把本地 7B 服务 (127.0.0.1:8000) 永久绑定到固定域名
#       https://api.jamescici.qzz.io —— 重启不换地址。
#
# 用法：右键“使用 PowerShell 运行”，或在 PowerShell 里执行：
#       powershell -ExecutionPolicy Bypass -File .\tunnel\setup-named-tunnel.ps1
#
# 只需运行一次。运行中会弹出浏览器，登录 Cloudflare 并选择
# jamescici.qzz.io 这个站点授权即可。
# ============================================================

$ErrorActionPreference = "Stop"

$CF       = "C:\Users\James\bin\cloudflared.exe"
$TUNNEL   = "breastcare"
$HOSTNAME = "api.jamescici.qzz.io"
$SERVICE  = "http://127.0.0.1:8000"
$CFDIR    = Join-Path $env:USERPROFILE ".cloudflared"
$CONFIG   = Join-Path $CFDIR "config.yml"

if (-not (Test-Path $CF)) { throw "找不到 cloudflared.exe：$CF" }
if (-not (Test-Path $CFDIR)) { New-Item -ItemType Directory -Path $CFDIR | Out-Null }

# 1) 登录（浏览器授权，选择 jamescici.qzz.io）
$certPath = Join-Path $CFDIR "cert.pem"
if (Test-Path $certPath) {
    Write-Host "[1/4] 已检测到 cert.pem，跳过登录。" -ForegroundColor Green
} else {
    Write-Host "[1/4] 即将打开浏览器登录 Cloudflare，请选择 jamescici.qzz.io 授权..." -ForegroundColor Cyan
    & $CF tunnel login
}

# 2) 创建隧道（已存在则复用）
$existing = (& $CF tunnel list 2>$null | Select-String -SimpleMatch $TUNNEL)
if ($existing) {
    Write-Host "[2/4] 隧道 '$TUNNEL' 已存在，复用。" -ForegroundColor Green
} else {
    Write-Host "[2/4] 创建隧道 '$TUNNEL'..." -ForegroundColor Cyan
    & $CF tunnel create $TUNNEL
}

# 找到隧道 UUID 和凭据文件
$uuid = ((& $CF tunnel list 2>$null | Select-String $TUNNEL) -split '\s+')[0]
if (-not $uuid) { throw "未能获取隧道 UUID，请检查 'cloudflared tunnel list' 输出。" }
$creds = Join-Path $CFDIR "$uuid.json"
if (-not (Test-Path $creds)) { throw "未找到凭据文件：$creds" }
Write-Host "    隧道 UUID = $uuid" -ForegroundColor DarkGray

# 3) 绑定固定域名（在 Cloudflare DNS 区里创建 CNAME）
Write-Host "[3/4] 绑定域名 $HOSTNAME ..." -ForegroundColor Cyan
& $CF tunnel route dns $TUNNEL $HOSTNAME

# 4) 写 config.yml
Write-Host "[4/4] 写入配置 $CONFIG ..." -ForegroundColor Cyan
@"
tunnel: $uuid
credentials-file: $creds

ingress:
  - hostname: $HOSTNAME
    service: $SERVICE
  - service: http_status:404
"@ | Set-Content -Path $CONFIG -Encoding utf8

Write-Host ""
Write-Host "✅ 配置完成！固定地址： https://$HOSTNAME" -ForegroundColor Green
Write-Host "   现在可以双击 tunnel\run-tunnel.bat 启动隧道（或运行：cloudflared tunnel run $TUNNEL）。" -ForegroundColor Green
