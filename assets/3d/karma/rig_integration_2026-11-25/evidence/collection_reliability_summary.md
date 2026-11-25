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

## 18:23 findings (strict test, sim-time recovery, 6 s per scenario unless noted; baseline fixture)
OBSERVATIONS
- history desktop, resize 768 -> 1440, earlier trace: she walked from her pre-resize x (about 450-690) across the card column to the right gutter at x about 1313, about 4 s, hidden while overlapping the card (by design hide while crossing). Trace file: evidence/trace_history_desktop_resize_2/log.txt. (An earlier trace, trace_history_desktop_resize, showed a box that did not move; the two traces were taken on different layout timings and I have not reconciled them.)
- islamic.html phone: page has one story card plus an obstacle block. The pick excluded the card she had just visited, so on a single-card page nothing was eligible and she waited hidden (rects in evidence/trace_islamic_phone_rects/log.txt). Her gutter box also intersects a full-width caption keep-out line at some scroll positions.
CHANGES (hypotheses behind them, not proven causes)
- On resize she snaps to the right-hand gutter column instead of crossing the cards.
- pick() falls back to the same card on single-card pages.
RESULTS AFTER CHANGES
- history desktop: all 8 scenarios V x6 (one run). A previous run of an earlier build showed hhhhhV at 768; run-to-run variation not yet assessed (single run per page).
- islamic phone: entry hhhhhh (card below the fold, no eligible card, expected), bottom hhhhhh (still hidden, caption keep-out; unresolved), other scenarios V. 

## 18:50 runs (build 4985099a, strict test, sim-time recovery, 6 s/scenario, single runs, baseline fixture, phone 390x844 start)
OBSERVATIONS (timelines V visible / h hidden)
- science: entry hhhhhh, all other scenarios V.  people: entry hhhhhh, others V.  women: entry hhhhhh, others V.  (entry: no eligible card in the viewport band at scroll 0, expected but not traced per page)
- islamic bottom (traced again, run 2): hhhVVV. Hidden about 3 s while she walked up the gutter past a caption keep-out rect (l15 t622 w360 h30); cleared on arrival at the card. Earlier run: hhhhhh. Run-to-run variation exists.
- LIVE wall-clock run (KARMA_LIVE=1, real time, no fastForward) history phone: entry hhhhhh, bottom hVVVVV, all other V. hiddenForMs advances about 1000 per real second, so the recovery clock matches wall time in the live loop (observation). In the live entry she ran in, then looked/pointed/waved at the viewport bottom (pos 340,840) with her box intersecting a keep-out text block rect (t694 h44, bottom 738) by 8 px for the whole sequence; pick() returned null at that moment (the card she was sent to is no longer in the eligible band). Deterministic-stepping entry run on the same page showed V x10 earlier, so live and stepped runs DIFFER at entry. Cause not established (hypothesis: layout shifts after load, e.g. images, change card positions after visit() chose its target).
UNRESOLVED: live entry hide; caption keep-out transits; entry-by-design classification per page; desktop only run on history; no Muse model.

## 19:10 live entry (build after 930ac717), history phone, real time, strict test, single runs
- Change 1: after a walk, visit() re-validates the card (reserve + eligibility). If layout moved it out of reach she does not gesture at it; she stands and retries.
- Run after change 1 (live_history_phone_after_revalidate): entry still hhhhhh: she idled at the floor (340,840) and her box intersected the keep-out text rect (8 px).
- Change 2: when no eligible card exists she parks off-screen right (x = vw + 2*halfW) and re-enters on the next scroll/resize/retry.
- Run after change 2 (live_history_phone_after_parkoff): entry = off-screen right (5 of 6 s off-screen, 1 s hidden), slideshow hVVVVV, all other scenarios VVVVVV. Entry absence is now off-screen, not a hidden model overlapping text. It is still ABSENT at entry on this page: no eligible card is in the viewport at scroll 0 (cards are below the fold), which I classify as by design (unconfirmed with the user).
- Single run; stepped re-run after change 2 not yet done.
