# Collection reliability, baseline fixture (NOT Muse's model), history.html, instant scrolls, software GL
Timeline: V = visible and fully on screen that second, h = hidden. Max overlap with cards while visible was 0 everywhere. No JS errors.

Phone 390x844 (seconds visible/total): entry 10/10, cards 12/12, slideshow 0/10 (intentional no-cover absence), bottom 10/10, resize 360x740 12/12, 768x1024 12/12, 1440x900 7/12, back 390x844 12/12.
Desktop 1440x900: entry 10/10, cards 12/12, slideshow 10/10, bottom 10/10, 360x740 12/12, 768x1024 10/12 (hhVV..), 1440x900 4/12 (hhhhhhhhVVVV), 390x844 12/12.
Transient after resize: hidden up to about 8 s, then she reappears. Cause not isolated; recovery waits 90 frames and software GL runs at low fps, so real-device time is unmeasured.

## Update 17:34 (desktop 1440x900 rerun after elapsed-time recovery, resize snap-in)
Desktop timelines: entry/cards/slideshow/bottom/360x740/768x1024/back-to-390 all VVVV (full). Resize to 1440x900 after 768x1024: hhhhhhhhhVVV (about 9 s hidden, still a defect, cause not isolated).
Tried and rejected: forcing a new visit on every resize and forcing recovery while walking made 768x1024 hidden for the whole 12 s (preempt livelock), so those were reverted. Kept: hidden recovery by elapsed time (1.2 s when idle), resize snap of her position into the viewport.
