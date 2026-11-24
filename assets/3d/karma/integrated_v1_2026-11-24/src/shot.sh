#!/bin/bash
# usage: shot.sh page.html?query out.png width height
python3 -m http.server 8765 >/dev/null 2>&1 & HP=$!; sleep 2
for i in $(seq 1 15); do timeout 100 google-chrome --headless=new --no-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --virtual-time-budget=90000 --window-size=$3,$4 --screenshot=$2 "http://localhost:8765/$1" >/dev/null 2>&1; [ $(stat -c%s $2) -gt 30000 ] && break; done
kill $HP
