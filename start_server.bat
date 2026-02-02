@echo off
chcp 65001
echo ローカルサーバーを起動しています...
echo 起動後、ブラウザで表示されたURL（例: http://localhost:3000）にアクセスしてください。
echo 終了するには Ctrl + C を押して、Y を入力してください。
echo.

call npx -y serve .

pause
