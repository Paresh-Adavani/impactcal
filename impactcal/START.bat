@echo off
cd /d %~dp0
if not exist node_modules ( echo Installing... & call npm install --no-audit --no-fund )
echo Starting ImpactCal on http://localhost:5000  (admin: http://localhost:5000/admin.html)
start "" http://localhost:5000
node --no-warnings tools\dev-server.js
