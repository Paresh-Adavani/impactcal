@echo off
rem Dated backup of the CSV database, GA library and docs (not node_modules / _legacy)
set D=%date:~-4%%date:~-7,2%%date:~-10,2%
set OUT=E:\claude\Backups\ImpactCal_%D%.zip
if not exist E:\claude\Backups mkdir E:\claude\Backups
powershell -NoProfile -Command "Compress-Archive -Path 'E:\claude\Projects\ImpactCal\data','E:\claude\Projects\ImpactCal\GA-LIBRARY','E:\claude\Projects\ImpactCal\docs','E:\claude\Projects\ImpactCal\site','E:\claude\Projects\ImpactCal\lib','E:\claude\Projects\ImpactCal\netlify' -DestinationPath '%OUT%' -Force"
echo Backup written to %OUT%
pause
