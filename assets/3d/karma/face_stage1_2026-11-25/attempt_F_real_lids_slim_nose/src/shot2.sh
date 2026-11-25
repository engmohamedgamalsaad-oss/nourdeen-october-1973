#!/bin/bash
cd /tmp/f; (python3 -m http.server 8765 >/dev/null 2>&1 &) ; sleep 1
google-chrome --headless=new --no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1800,600 --virtual-time-budget=20000 --screenshot=$2 "http://localhost:8765/r/view2.html?f=/src/$1&clay=$3&yaws=$4" >/dev/null 2>&1
pkill -f "http.server 8765"; ls -la $2
