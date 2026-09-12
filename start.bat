@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Portfolio - Local Dev Startup

echo ============================================
echo   Portfolio - Local Dev One-Click Startup
echo ============================================
echo.

rem ---- Check environment ----
where uv >nul 2>nul
if errorlevel 1 (
    echo [ERROR] uv not found. Install from https://docs.astral.sh/uv/ and add to PATH.
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm not found. Install Node.js first.
    pause
    exit /b 1
)

rem ---- Backend: sync dependencies ----
echo [1/4] Syncing backend dependencies - uv sync ...
cd /d "%~dp0backend"
uv sync
if errorlevel 1 (
    echo [ERROR] Backend dependency sync failed. Check Python 3.13+ and uv.
    pause
    exit /b 1
)

rem ---- Backend: apply database migrations ----
echo [2/4] Applying database migrations - alembic upgrade head ...
uv run alembic upgrade head
if errorlevel 1 (
    echo [ERROR] Migration failed. Make sure PostgreSQL is running and backend\.env DATABASE_URL is correct.
    pause
    exit /b 1
)

rem ---- Backend: seed base data ----
echo [3/4] Seeding base data ...
uv run python -m app.db.seed
if errorlevel 1 (
    echo [ERROR] Seeding base data failed.
    pause
    exit /b 1
)

cd /d "%~dp0"

rem ---- Frontend: install dependencies - first run only ----
if not exist "node_modules" (
    echo Installing frontend dependencies - npm install ...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Frontend dependency install failed.
        pause
        exit /b 1
    )
)

rem ---- Start servers ----
echo [4/4] Starting backend and frontend...
start "portfolio-backend" /D "%~dp0backend" cmd /k "uv run python run.py"
start "portfolio-frontend" cmd /k "npm run dev"

echo.
echo ============================================
echo   Starting, please wait a few seconds:
echo     Frontend   http://localhost:5173
echo     Admin      http://localhost:5173/admin
echo     API Docs   http://localhost:8000/api/docs
echo     Login: admin / admin123
echo.
echo   Stop: close the two newly opened windows.
echo ============================================
echo.
pause
