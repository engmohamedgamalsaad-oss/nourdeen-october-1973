#!/bin/bash
cd /tmp/f; (python3 -m http.server 8765 >/dev/null 2>&1 &) ; sleep 1
google-chrome --headless=new --no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1800,600 --virtual-time-budget=20000 --screenshot=$2 "http://localhost:8765/r/view3.html?f=/src/$1&clay=0&yaws=0,35,75&S=.45&tx=.5&ty=0&tz=-.3" >/dev/null 2>&1
pkill -f "http.server 8765"
