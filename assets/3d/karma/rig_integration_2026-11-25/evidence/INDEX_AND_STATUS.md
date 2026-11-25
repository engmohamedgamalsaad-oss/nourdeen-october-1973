# Evidence index and status (updated 19:27, build c2ce0969 + this commit)
Baseline fixture only. Software GL. Strict test (zero tolerance). Mostly single runs.

## SUPERSEDED / UNVERIFIED (do not cite as stability evidence)
All STEPPED V/h timelines and debug hit data produced before commit c2ce0969 (the stepped harness did not call the cover guard). This includes the folders: collection_reliability_phone_history, collection_reliability_desktop_history, collection_reliability_phone_{islamic,science,people,women,dynamic}, trace_history_desktop_resize, trace_history_desktop_resize_2, history_desktop_after_snap, trace_islamic_phone_rects, islamic_phone_after_pick_fix, trace_islamic_phone_bottom, strict_{science,people,women}_phone, desktop_science_stepped, trace_history_phone_entry_stepped_meshbounds, desktop_people_stepped_pre_guardfix, trace_desktop_people_768_pre_guardfix, and the stepped sections of collection_reliability_summary.md.
Also superseded: the elapsed-time vs 90-frame comparison, the 'resize snap' and 'single-card revisit' fixes were motivated by invalid stepped runs (they remain in the code, justified only by their own logic, not by that evidence). The 17:11 'strict test' claim was wrong until commit 3e454f38.
Not affected: live wall-clock runs (KARMA_LIVE=1): live_wallclock_history_phone, live_history_phone_after_revalidate, live_history_phone_after_parkoff, and the live runs below.

## CURRENT (post-fix, c2ce0969 or later)
- desktop_people_stepped_guard_in_fastforward: 8 x VVVVVV (1 s mesh clip at entry while running in).
- history_phone_stepped_guard_in_fastforward: entry hhhhhh (absent), others V.
- islamic_phone_stepped_corrected: entry hhhhhh (6 s off-screen, no eligible card), all others VVVVVV.
- islamic_phone_live_corrected (real time): entry hhhhhh off-screen; 768x1024 hhVVVV (2 s transient); others V.
- history_desktop_live (real time, 4 s per scenario): bottom hhVV, 768x1024 hhVV (2 s transients), others V.
Live vs stepped differ by 2 s transients at tablet resize and at bottom (live only). Not explained; single runs.

- science_phone_stepped_corrected: entry hhhhhh (4 s off-screen), cards V, slideshow hhhhVV (4 s off-screen waiting), bottom V (1 s mesh clip), others V.
- people_phone_stepped_corrected: entry absent, cards V, slideshow V, bottom VVVVhh (2 s off-screen), others V.
- women_phone_stepped_corrected: entry absent, cards V (1 s mesh clip), others V.
Pixels inspected 19:38 by me: science phone cards (Karma in the bottom-right gutter beside card 2, clear of text/image), desktop people 1440x900 (beside card 2 in the right gutter, clear), people phone bottom (absent at that sample).

## Open
- Phone entry at scroll 0 is absent (acceptance 'enters from the right and stays beside the cards' not met at load; met after scrolling to the cards). Prototype fallback.
- 2 s transient hides in live resize / bottom runs.
- Other pages (science/people/women/dynamic) not rerun post-fix on phone; desktop other than history/people not rerun post-fix.
- No multiple runs per page, no real device, no Muse model (none received), baseline over the 60k tri gate.
