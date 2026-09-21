@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 大前端学院 - 生产模式 (PROD)

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
echo [1/2] 正在构建前端（vite build，输出到 web\dist）...
call npm run build
if errorlevel 1 (
  echo.
  echo [错误] 前端构建失败，已终止，未启动服务器。
  pause
  exit /b 1
)

echo.
echo ============================================================
echo   大前端学院 · 生产模式 (PROD)  已启动
echo   由后端 Express 单端口托管前端静态资源
echo   访问：  http://127.0.0.1:3001
echo   停止：  在本窗口按 Ctrl + C
echo ============================================================
echo.

call npm run start

echo.
echo [生产模式已退出]
pause
