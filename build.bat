@echo off
setlocal enabledelayedexpansion

REM 
set "OUTPUT_ZIP=chrome.zip"
set "SOURCE_DIR=src"
REM 

REM 
set "SCRIPT_DIR=%~dp0"
REM 
if not "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR%\"

echo Starting Windows build process...

REM 
pushd "%SCRIPT_DIR%"
if errorlevel 1 (
    echo Error: Failed to change directory to %SCRIPT_DIR%
    exit /b 1
)
echo Current directory: %cd%

REM 
set "FULL_OUTPUT_PATH=%SCRIPT_DIR%%OUTPUT_ZIP%"
echo Removing old archive: %FULL_OUTPUT_PATH%...
if exist "%FULL_OUTPUT_PATH%" (
    del /F /Q "%FULL_OUTPUT_PATH%"
    if errorlevel 1 (
        echo Warning: Failed to delete existing archive '%FULL_OUTPUT_PATH%'. It might be in use.
    )
) else (
    echo No existing archive found.
)

REM 
set "FULL_SOURCE_PATH=%SCRIPT_DIR%%SOURCE_DIR%"
echo Checking for source directory: %FULL_SOURCE_PATH%...
if not exist "%FULL_SOURCE_PATH%" (
    echo Error: Source directory '%FULL_SOURCE_PATH%' not found.
    popd
    exit /b 1
)
if not exist "%FULL_SOURCE_PATH%\*" (
    echo Error: Source directory '%FULL_SOURCE_PATH%' is empty.
    popd
    exit /b 1
)
echo Source directory found.

REM 
echo Creating archive '%OUTPUT_ZIP%' from contents of '%SOURCE_DIR%'...

REM 
set "PS_COMMAND=Compress-Archive -Path '%FULL_SOURCE_PATH%\*' -DestinationPath '%FULL_OUTPUT_PATH%' -Force"

REM 
powershell -NoProfile -ExecutionPolicy Bypass -Command "& {%PS_COMMAND%}"

REM 
if errorlevel 1 (
    echo Error: Failed to create zip archive using PowerShell. Check PowerShell version (requires v5+) and permissions.
    popd
    exit /b 1
)

echo Successfully created '%OUTPUT_ZIP%' in %SCRIPT_DIR%.

REM 
REM 
popd
echo Build process completed successfully.

endlocal
exit /b 0