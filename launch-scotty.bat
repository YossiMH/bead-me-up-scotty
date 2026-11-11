@echo off
setlocal
cd /d "%~dp0" || exit /b 1
node ".\bin\bead-me-up-scotty.mjs" --host 127.0.0.1 %*
set "SCOTTY_EXIT_CODE=%ERRORLEVEL%"
if not "%SCOTTY_EXIT_CODE%"=="0" (
    echo.
    echo Scotty stopped with error %SCOTTY_EXIT_CODE%.
    pause
)
exit /b %SCOTTY_EXIT_CODE%
