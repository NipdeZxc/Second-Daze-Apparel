@echo off
setlocal
cd /d "%~dp0django_frontend"
if errorlevel 1 goto failed

set "VENV_PYTHON=%CD%\.venv\Scripts\python.exe"

if not exist "%VENV_PYTHON%" (
    echo Creating Django virtual environment...
    py -3 -m venv .venv
    if errorlevel 1 goto failed
)

"%VENV_PYTHON%" -c "import django" >nul 2>&1
if errorlevel 1 (
    echo Installing Django dependencies. This is only needed on first run...
    "%VENV_PYTHON%" -m pip install -r requirements.txt
    if errorlevel 1 goto failed
)

"%VENV_PYTHON%" -c "import socket,sys;s=socket.socket();r=s.connect_ex(('127.0.0.1',8000));s.close();sys.exit(r==0)"
if errorlevel 1 (
    echo Port 8000 is already in use. Opening the existing local server.
    start "" "http://127.0.0.1:8000/"
    exit /b 0
)

echo Starting Django. Keep this window open while testing.
start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "$url='http://127.0.0.1:8000/'; $deadline=(Get-Date).AddSeconds(30); while ((Get-Date) -lt $deadline) { try { $response=Invoke-WebRequest -Method Head -Uri $url -UseBasicParsing -TimeoutSec 1; if ($response.StatusCode -eq 200) { Start-Process $url; exit 0 } } catch { Start-Sleep -Milliseconds 500 } }"
"%VENV_PYTHON%" manage.py runserver 127.0.0.1:8000
exit /b %ERRORLEVEL%

:failed
echo Could not prepare the Django environment. Check that Python 3 is installed and try again.
pause
exit /b 1
