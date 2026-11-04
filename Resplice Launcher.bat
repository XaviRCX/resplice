@echo off
setlocal
set "PATH=C:\Users\Lucas\AppData\Local\hermes\node;%PATH%"
cd /d "C:\Users\Lucas\ai-dj-studio"

rem Encerra servidor antigo na porta 3939 (app) e 3941 (downloads/clips)
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr "3939"') do taskkill /PID %%p /F >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr "3941"') do taskkill /PID %%p /F >nul 2>&1
ping -n 2 127.0.0.1 >nul

rem Servidor auxiliar de downloads (serve os MP3 gerados; Next nao entrega binarios grandes)
start "" /min cmd /c "C:\Users\Lucas\AppData\Local\hermes\node\node.exe C:\Users\Lucas\ai-dj-studio\downloads-server.mjs"

rem Abre o navegador (127.0.0.1 para casar com o redirect do Spotify)
start "" "http://127.0.0.1:3939/"

echo [Resplice] Abrindo http://127.0.0.1:3939/
echo [Resplice] Mantenha esta janela aberta. Feche-a (Ctrl+C) para parar.

call npm start -- -p 3939

endlocal
