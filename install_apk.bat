@echo off
echo ========================================================
echo   RSM Messenger - Android APK Auto Installer
echo ========================================================
echo Checking connected Android devices / emulators...
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" devices

echo.
echo Installing RSM-Messenger.apk...
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" install -r "%~dp0RSM-Messenger.apk"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo   SUCCESS! RSM Messenger installed on device!
    echo ========================================================
    echo Launching RSM Messenger...
    "%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" shell monkey -p com.rsmmessenger.app -c android.intent.category.LAUNCHER 1
) else (
    echo.
    echo Please make sure an Android device is connected with USB Debugging enabled,
    echo or an Android emulator is running.
)
pause
