@echo off
echo Starting Clipt Enterprise Server...
cd "%~dp0clipt"
npx serve -s . -p 3000
pause
