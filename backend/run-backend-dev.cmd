@echo off
setlocal

rem ===========================================================================
rem  Start the backend for LOCAL DEVELOPMENT.
rem
rem  Loads the repo-root .env first (AMAP_API_KEY, GOOGLE_MAPS_API_KEY, ...).
rem  Without AMAP_API_KEY the attraction image provider silently returns
rem  "no photo" and every card falls back to the placeholder, which looks like
rem  "images disappeared".
rem
rem  Then sets the three variables the settings page needs:
rem    SETTINGS_ALLOW_SECRET_UPDATES=true  -> allow writing secrets from the UI
rem    SETTINGS_ADMIN_TOKEN=hello123       -> the passphrase typed as admin token
rem    PORT=8001                           -> must match frontend/.env.local
rem
rem  Double-click to start. Close the window (Ctrl+C) to stop.
rem  Only one instance can run at a time ("Port 8001 was already in use").
rem ===========================================================================

set "JAVA_HOME=C:\Program Files\JetBrains\IntelliJ IDEA 2023.3.6\jbr"
set "JAR=%~dp0target\HelloJourney-backend-2.0.0.jar"
set "DOTENV=%~dp0..\.env"

if not exist "%JAR%" goto no_jar
if not exist "%JAVA_HOME%\bin\java.exe" goto no_jdk

if exist "%DOTENV%" (
  echo Loading env from %DOTENV%
  for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%DOTENV%") do (
    if not "%%~a"=="" set "%%~a=%%~b"
  )
) else (
  echo [WARN] No .env found at %DOTENV% - attraction photos will not load.
)

rem Settings-page permissions (win over .env, in case it sets them to false)
set "SETTINGS_ALLOW_SECRET_UPDATES=true"
set "SETTINGS_ADMIN_TOKEN=hello123"
set "PORT=8001"

cd /d "%~dp0"
echo Starting backend on http://127.0.0.1:%PORT%
echo Admin token (for the settings page): %SETTINGS_ADMIN_TOKEN%
echo AMAP_API_KEY loaded: %AMAP_API_KEY:~0,4%****
echo.

"%JAVA_HOME%\bin\java.exe" -jar "%JAR%"

echo.
echo Backend stopped. Exit code: %ERRORLEVEL%
pause
goto :eof

:no_jar
echo [ERROR] JAR not found: %JAR%
echo         Build it first:  mvn -DskipTests package
goto done

:no_jdk
echo [ERROR] JDK not found: %JAVA_HOME%\bin\java.exe
goto done

:done
echo.
pause
