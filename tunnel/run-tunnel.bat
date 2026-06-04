@echo off
REM ============================================================
REM 启动 BreastCare-VL 命名隧道（固定域名 api.jamescici.qzz.io）
REM 双击本文件即可。需保持窗口开着；关闭即断开隧道。
REM 前提：本地 7B 服务已在 127.0.0.1:8000 运行。
REM ============================================================
title BreastCare-VL Cloudflare Tunnel
echo 正在启动命名隧道 breastcare -> https://api.jamescici.qzz.io ...
"C:\Users\James\bin\cloudflared.exe" tunnel run breastcare
echo.
echo 隧道已停止。按任意键关闭窗口。
pause >nul
