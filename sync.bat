@echo off
cd C:\Users\isaac\elared-report-system
git add .
git commit -m "sync: %date% %time%"
git push origin master
echo Push completado exitosamente
pause
