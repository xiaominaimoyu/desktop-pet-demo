@echo off
chcp 65001 >nul
echo 正在启动 Desktop Pet...
echo.
cd /d "d:\project file\Desktop_Pet\src-tauri\target\release"
start "" "desktop-pet.exe"
echo Desktop Pet 已启动，请查看屏幕右上角或系统托盘。
timeout /t 2 >nul
