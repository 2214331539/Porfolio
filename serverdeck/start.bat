@echo off
setlocal
title Server Deck
cd /d "%~dp0"

where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js 22 or newer is required. Please install it and try again.
  pause
  exit /b 1
)

node "%~dp0scripts\start.mjs"
if errorlevel 1 (
  echo.
  echo Server Deck could not start. Please check the message above.
  pause
  exit /b 1
)
endlocal
