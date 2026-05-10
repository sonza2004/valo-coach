# ── VALO COACH — Push & Deploy Script ──────────────────────────────────────
# วิธีใช้: right-click → Run with PowerShell
# หรือ: cd "C:\agile\AI\memory\Valorant\valo-coach" && .\push.ps1

$PROJECT = "C:\agile\AI\memory\Valorant\valo-coach"
$REPO    = "sonza2004/valo-coach"

# ── Token: ตั้งค่าครั้งแรก หรือ export เป็น env var ──────────────────────────
# ถ้าไม่ได้ตั้ง env var จะ prompt ให้กรอก
$TOKEN = $env:GITHUB_TOKEN
if (-not $TOKEN) {
    $TOKEN = Read-Host "GitHub PAT token"
}

$REMOTE = "https://$TOKEN@github.com/$REPO.git"

Write-Host "`n[VALO COACH] Starting deploy..." -ForegroundColor Cyan
Set-Location $PROJECT

if (-not (Test-Path ".git")) {
    git init
    git remote add origin $REMOTE
} else {
    git remote set-url origin $REMOTE
}

git config user.email "jirasin.krissanan@gmail.com"
git config user.name  "Jirasin"
git add -A

$msg = Read-Host "Commit message (Enter ใช้ default)"
if (-not $msg) { $msg = "update: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" }
git commit -m $msg

Write-Host "  Pushing to GitHub ($REPO)..." -ForegroundColor Yellow
git push -u origin main 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[OK] Push success! Vercel auto-deploys in 1-2 min" -ForegroundColor Green
    Write-Host "      https://valo-coach-xi.vercel.app" -ForegroundColor Cyan
} else {
    git push -u origin master 2>&1
}

Write-Host "`nกด Enter เพื่อปิด..."
Read-Host
