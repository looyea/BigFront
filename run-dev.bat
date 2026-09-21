@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 大前端学院 - 开发模式 (DEV)

rem 若缺任一依赖则先安装（根目录 + server + web）
set NEED_INSTALL=0
if not exist "node_modules" set NEED_INSTALL=1
if not exist "server\node_modules" set NEED_INSTALL=1
if not exist "web\node_modules" set NEED_INSTALL=1
if "%NEED_INSTALL%"=="1" (
  echo [提示] 未检测到完整依赖，正在安装：npm run install:all ...
  echo.
  call npm run install:all
)

echo.
echo ============================================================
echo   大前端学院 · 开发模式 (DEV)  已启动
echo   前端 Vite :  http://localhost:5173     （日常访问这个）
echo   后端 API  :  http://127.0.0.1:3001
echo   停止服务  :  在本窗口按 Ctrl + C
echo ============================================================
echo.

call npm run dev

echo.
echo [开发模式已退出]
pause
