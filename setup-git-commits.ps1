# ============================================================
#  Juan Chupe Granizados — Setup inicial de Git commits
#  Ejecutar desde: la carpeta raíz del proyecto (juan-chupe-erp)
#  Comando: .\setup-git-commits.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

Write-Host "`n[1/9] Limpiando lock file si existe..." -ForegroundColor Cyan
$lockFile = Join-Path $repoRoot ".git\index.lock"
if (Test-Path $lockFile) {
    Remove-Item $lockFile -Force
    Write-Host "      index.lock eliminado." -ForegroundColor Green
} else {
    Write-Host "      No habia lock file." -ForegroundColor Gray
}

# Configurar identidad si no está
git config user.email "miguel.ospina.dev@gmail.com"
git config user.name  "Miguel Ospina"

# ────────────────────────────────────────────────────────────
# COMMIT 1 — Base del repositorio
# ────────────────────────────────────────────────────────────
Write-Host "`n[2/9] Commit 1: chore — init repo" -ForegroundColor Cyan
git add .gitignore README.md
git commit -m "chore: init repo con README y .gitignore"

# ────────────────────────────────────────────────────────────
# COMMIT 2 — Backend: estructura Django completa
# ────────────────────────────────────────────────────────────
Write-Host "`n[3/9] Commit 2: feat — backend Django setup" -ForegroundColor Cyan
git add backend/config/ backend/core/ backend/manage.py backend/requirements.txt
git commit -m "feat(backend): setup Django project con apps y configuracion base"

# ────────────────────────────────────────────────────────────
# COMMIT 3 — Backend: apps de negocio (primera version)
# ────────────────────────────────────────────────────────────
Write-Host "`n[4/9] Commit 3: feat — apps core de negocio" -ForegroundColor Cyan
git add backend/apps/
git commit -m "feat(backend): apps products, inventory, sales, shifts, expenses, promotions, billing, deliveries, attendance, users, reports"

# ────────────────────────────────────────────────────────────
# COMMIT 4 — Frontend: setup Vite + React + Tailwind
# ────────────────────────────────────────────────────────────
Write-Host "`n[5/9] Commit 4: feat — frontend Vite+React+Tailwind" -ForegroundColor Cyan
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js `
        frontend/tailwind.config.js frontend/postcss.config.js frontend/index.html `
        frontend/public/
git commit -m "feat(frontend): setup Vite + React + Tailwind CSS"

# ────────────────────────────────────────────────────────────
# COMMIT 5 — Frontend: UI enterprise (sidebar, topbar, layout, login)
# ────────────────────────────────────────────────────────────
Write-Host "`n[6/9] Commit 5: feat — UI enterprise con SVG icons" -ForegroundColor Cyan
git add frontend/src/components/ frontend/src/styles/ frontend/src/pages/Login.jsx `
        frontend/src/App.jsx frontend/src/main.jsx frontend/src/api/
git commit -m "feat(frontend): UI enterprise — sidebar navy, SVG icons, Login split-panel, estilos globales"

# ────────────────────────────────────────────────────────────
# COMMIT 6 — Frontend: Dashboard con filtros y tabla de ventas
# ────────────────────────────────────────────────────────────
Write-Host "`n[7/9] Commit 6: feat — Dashboard con filtros y alertas" -ForegroundColor Cyan
git add frontend/src/pages/Dashboard.jsx
git commit -m "feat(frontend): Dashboard con filtro POS/Domicilios, stats cards, ventas recientes y alertas de stock"

# ────────────────────────────────────────────────────────────
# COMMIT 7 — Frontend: POS rediseñado
# ────────────────────────────────────────────────────────────
Write-Host "`n[8/9] Commit 7: feat — POS sin emojis" -ForegroundColor Cyan
git add frontend/src/pages/POS.jsx
git commit -m "feat(frontend): POS con SVG icons, color circles para sabores, fix duplicate import createSale"

# ────────────────────────────────────────────────────────────
# COMMIT 8 — Productos: CRUD completo + timestamps + minimums
# ────────────────────────────────────────────────────────────
Write-Host "`n[9/9] Commit 8: feat — Products CRUD + timestamps + minimos" -ForegroundColor Cyan
git add frontend/src/pages/Products.jsx `
        backend/apps/products/models.py `
        backend/apps/products/serializers.py `
        backend/apps/products/views.py `
        backend/apps/products/migrations/
git commit -m "feat: Products CRUD completo — bolsas, vasos, toppings con edicion inline, toggle activo/inactivo, eliminacion, timestamps created_at/updated_at y stock minimos (min_stock_ml, min_quantity, min_stock)"

# Resto de archivos sin comitear (otras pages)
$remaining = git status --short
if ($remaining) {
    Write-Host "`n[+] Commiteando paginas restantes del frontend..." -ForegroundColor Cyan
    git add frontend/src/pages/
    git commit -m "feat(frontend): resto de paginas — Billing, Deliveries, Expenses, Inventory, Reports, Users, Shifts, Attendance, Promotions, CashAudit"
}

Write-Host "`n================================================" -ForegroundColor Green
Write-Host " Todos los commits creados exitosamente!" -ForegroundColor Green
Write-Host "================================================`n" -ForegroundColor Green
git log --oneline
