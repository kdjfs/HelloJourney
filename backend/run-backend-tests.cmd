@echo off
setlocal

rem ===========================================================================
rem  Run backend tests on Windows.
rem
rem  Why this file exists:
rem  1) JAVA_HOME points to C:\Java\jdk-17, which only contains an MSI
rem     installer (no bin\java.exe), so plain "mvn" fails.
rem  2) Maven is not on PATH, but IntelliJ ships one.
rem  This script uses IntelliJ's bundled JDK 17 + bundled Maven.
rem
rem  Usage:
rem    run-backend-tests.cmd             -> run all tests
rem    run-backend-tests.cmd Settings    -> only test classes matching "Settings"
rem ===========================================================================

set "JAVA_HOME=C:\Program Files\JetBrains\IntelliJ IDEA 2023.3.6\jbr"
set "MVN=C:\Program Files\JetBrains\IntelliJ IDEA 2023.3.6\plugins\maven\lib\maven3\bin\mvn.cmd"

if not exist "%JAVA_HOME%\bin\java.exe" goto no_jdk
if not exist "%MVN%" goto no_maven

cd /d "%~dp0"

echo JDK   : %JAVA_HOME%
echo Maven : %MVN%
echo Dir   : %CD%
echo.

if "%~1"=="" goto run_all

echo [run] test classes matching: %~1
call "%MVN%" "-Dtest=*%~1*" "-Dsurefire.failIfNoSpecifiedTests=false" test
goto done

:run_all
echo [run] all tests
call "%MVN%" test
goto done

:no_jdk
echo [ERROR] JDK not found: %JAVA_HOME%\bin\java.exe
echo         Edit JAVA_HOME at the top of this file.
goto done

:no_maven
echo [ERROR] Maven not found: %MVN%
echo         Edit MVN at the top of this file.
goto done

:done
echo.
echo Exit code: %ERRORLEVEL%
pause
