tar -C dist -cf game.tar .
.\brotli.exe -q 11 -f game.tar   # produces game.tar.br
Remove-Item game.tar