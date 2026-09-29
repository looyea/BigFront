@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 大前端学院 - 生产模式 (PROD)

rem 自我以 :waitopen 身份再启一次时（后台等端口就绪后开浏览器），直接跳到子过程，不重复走构建/启动流程
if "%~1"==":waitopen" goto :waitopen

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

rem 后台轮询：服务一就绪就用系统默认浏览器打开首页（npm run start 会阻塞占住本窗口，故另起进程）
start "" /min cmd /c ""%~f0" :waitopen http://127.0.0.1:3001"

call npm run start

echo.
echo [生产模式已退出]
pause
exit /b 0

:waitopen
rem 每约 1 秒探测一次，最多 60 次；探测成功（HTTP 2xx/3xx）即打开浏览器退出
set _u=%~2
for /L %%i in (1,1,60) do (
  curl.exe -s -f -o nul "%_u%" && ( start "" "%_u%" & goto :eof )
  ping -n 2 127.0.0.1 >nul
)
rem 超时兜底：仍打开一次（页面可能报错，但总比你找不到入口强）
start "" "%_u%"
goto :eof
