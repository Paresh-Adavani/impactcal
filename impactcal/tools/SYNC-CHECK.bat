@echo off
rem Mirrors GA-LIBRARY and data\ into the Google Drive "ImpactCal" folder (the one shared with the service account).
rem Edit DRIVE to the path Google Drive for Desktop shows for "My Drive\ImpactCal".
set DRIVE=G:\My Drive\ImpactCal
if not exist "%DRIVE%" ( echo Drive folder not found: %DRIVE% & pause & exit /b 1 )
robocopy "E:\claude\Projects\ImpactCal\GA-LIBRARY" "%DRIVE%\GA-LIBRARY" *.pdf /S /XD _tools _excluded /NFL /NDL /NJH
robocopy "E:\claude\Projects\ImpactCal\data" "%DRIVE%\data" *.csv /S /NFL /NDL /NJH
echo Done. The nightly drive-sync function (or Admin -> Drawings & Drive -> Sync now) pulls the new PDFs into the app.
pause
