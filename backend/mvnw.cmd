@echo off
setlocal

set "MAVEN_VERSION=3.9.11"
set "MAVEN_CACHE_HASH=03d7e36a140982eea48e22c1dcac01d8862b2550b2939e09a0809bbc5182a5bc"

if "%MAVEN_USER_HOME%"=="" (
  set "MAVEN_USER_HOME=%USERPROFILE%\.m2"
)

set "MAVEN_HOME=%MAVEN_USER_HOME%\wrapper\dists\apache-maven-%MAVEN_VERSION%\%MAVEN_CACHE_HASH%"

if not exist "%MAVEN_HOME%\bin\mvn.cmd" (
  echo Apache Maven %MAVEN_VERSION% is not available in the local Maven Wrapper cache:
  echo %MAVEN_HOME%
  echo Cache Maven %MAVEN_VERSION% locally before running this no-download wrapper.
  exit /b 1
)

call "%MAVEN_HOME%\bin\mvn.cmd" %*
exit /b %ERRORLEVEL%
