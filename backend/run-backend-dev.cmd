@echo off
setlocal

rem ===========================================================================
rem  Start the backend for LOCAL DEVELOPMENT.
rem
rem  It sets the three variables the settings page needs:
rem    SETTINGS_ALLOW_SECRET_UPDATES=true  -> allow writing secrets (relay key,
rem                                           xhs cookie) from the settings page
rem    SETTINGS_ADMIN_TOKEN=hello123       -> the passphrase you type in the
rem                                           "admin token" field
rem    PORT=8001                           -> must match frontend/.env.local
rem
rem  Double-click to start. Close the window (or press Ctrl+C) to stop.
rem  NOTE: only one instance can run at a time (otherwise "Port 8001 was
rem  already in use").
rem ===========================================================================

set "JAVA_HOME=C:\Program Files\JetBrains\IntelliJ IDEA 2023.3.6\jbr"
set "JAR=%~dp0target\HelloJourney-backend-2.0.0.jar"

set "SETTINGS_ALLOW_SECRET_UPDATES=true"
set "SETTINGS_ADMIN_TOKEN=hello123"
set "PORT=8001"

if not exist "%JAR%" goto no_jar
if not exist "%JAVA_HOME%\bin\java.exe" goto no_jdk

cd /d "%~dp0"
echo Starting backend on http://127.0.0.1:%PORT%
echo Admin token (for the settings page): %SETTINGS_ADMIN_TOKEN%
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
