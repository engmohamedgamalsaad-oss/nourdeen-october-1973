# Collection reliability, baseline fixture (NOT Muse's model), history.html, instant scrolls, software GL
Timeline: V = visible and fully on screen that second, h = hidden. Max overlap with cards while visible was 0 everywhere. No JS errors.

Phone 390x844 (seconds visible/total): entry 10/10, cards 12/12, slideshow 0/10 (intentional no-cover absence), bottom 10/10, resize 360x740 12/12, 768x1024 12/12, 1440x900 7/12, back 390x844 12/12.
Desktop 1440x900: entry 10/10, cards 12/12, slideshow 10/10, bottom 10/10, 360x740 12/12, 768x1024 10/12 (hhVV..), 1440x900 4/12 (hhhhhhhhVVVV), 390x844 12/12.
Transient after resize: hidden up to about 8 s, then she reappears. Cause not isolated; recovery waits 90 frames and software GL runs at low fps, so real-device time is unmeasured.

## Update 17:34 (desktop 1440x900 rerun after elapsed-time recovery, resize snap-in)
Desktop timelines: entry/cards/slideshow/bottom/360x740/768x1024/back-to-390 all VVVV (full). Resize to 1440x900 after 768x1024: hhhhhhhhhVVV (about 9 s hidden, still a defect, cause not isolated).
Tried and rejected: forcing a new visit on every resize and forcing recovery while walking made 768x1024 hidden for the whole 12 s (preempt livelock), so those were reverted. Kept: hidden recovery by elapsed time (1.2 s when idle), resize snap of her position into the viewport.

## science.html, phone 390x844 (17:37, baseline fixture)
entry hhhhhhhhhh, cards VVVVVVVVVVVV, slideshow hhhhhhhhhh, bottom VVVVVVVVVV, 360x740 V x12, 768x1024 V x12, 1440x900 hhhVVVVVVVVV, back 390x844 V x12. Overlap 0. Entry-at-top hidden is unclassified: no card is in the viewport band at scroll 0 on this page (to be checked against screenshot), so absence may be by design.

## islamic.html, phone 390x844 (17:40, baseline fixture) UNRESOLVED FAILURES
entry h x10, cards V x12, slideshow V x10, bottom h x10, 360x740 h x12, 768x1024 h x12, 1440x900 V x12, back 390x844 V x12. Overlap 0. Causes not yet traced.

## people / women / dynamic, phone 390x844 (17:50, baseline fixture)
people: entry h x10, cards V x12, slideshow h x10, bottom V x10, 360x740 V x12, 768x1024 hhhhhhhVVVVV, 1440x900 hhhhhhhVVVVV, back V x12.
women: entry h x10, cards V x12, slideshow h x10, bottom V x10, 360x740 V x12, 768x1024 hhV..., 1440x900 hhhV..., back V x12.
dynamic: h in all 8 scenarios, final state cardW=null, visits=0: no story cards are in the DOM in this offline test (page is data-driven; Supabase was not touched), so the stage had no target. Not testable here, not a stage verdict.
Overlap with cards while visible: 0 on all pages. Entry hidden on science/people/women/islamic: no card in viewport band at scroll 0 (trace pending). Transient post-resize hide 2 to 7 s on several pages.

## CORRECTIONS and trace (17:58)
1. The earlier 17:11 note that the on-screen test was strict was wrong: the +3 px tolerance in tests/collection_reliability.py stayed in the committed file until now. It is removed in this commit (onScreen requires y <= innerHeight). The 3-px tolerance only affected the feet-clip check. Phone rows earlier than this commit used +3.
2. The harness advances time with fastForward (simulated 60 fps), not wall clock. The elapsed-time recovery used performance.now, so the earlier elapsed-time runs were not a valid test of it. It now uses simulated time (simT). The elapsed-time hypothesis is therefore NOT cleanly disproven or confirmed; the 90-frame result and the elapsed-time results were not comparable.
3. history.html desktop, 6 s per scenario, sim-time recovery: 768x1024 hhhhhV (5 s hidden), 1440x900 hhVVVV. Other scenarios V.
4. Trace (KARMA_TRACE=1, 1440x900 resize after 768, trace_history_desktop_resize/log.txt): busy=true, epoch 4, a pick exists (side right, 5 cards), action walk for about 3 s, then look, point; vis=false throughout, including while pointing at the card. So she completes the walk and the gestures while hidden: her arrival stand position still overlaps something (card/keep-out/slideshow) after resize, or the position was computed against pre-resize geometry. Not resolved.
