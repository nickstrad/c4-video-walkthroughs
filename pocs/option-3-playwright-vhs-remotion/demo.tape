Output public/terminal.mp4
Set Shell "bash"
Set Width 1200
Set Height 570
Set FontSize 24
Set Padding 24
Set Framerate 30
Set TypingSpeed 15ms
Set Theme "Dracula"
Set WaitTimeout 60s
Hide
Type "export PS1='litefleet@9367863 $ '; cd .work/pinned/books/release-it/project; clear"
Enter
Sleep 300ms
Show
Type "go test -count=1 -v ./internal/breaker"
Enter
Wait+Screen /PASS/
Sleep 6s
