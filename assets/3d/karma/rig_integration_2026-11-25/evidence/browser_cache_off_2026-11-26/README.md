# Browser evidence with the network cache disabled (latest verified revision)
Real headless Chrome, real index.html, baseline fixture NOT FINAL (not Muse), software GL, stepped sim clock, phone 390x844 emulation, single run. Not a device. The run JSON records `_run`: git head (+dirty = uncommitted working tree at run time), `cache_disabled`, and for every loaded same-origin JS file its status, `fromDiskCache` and a sha256 prefix of the file on disk.
phone_run_final (git head aa669a49+dirty; the working tree is committed in the commit that adds this folder): any_from_cache false. 37 samples; controller-box overlap while visible 0; rendered-footprint penetration while visible max 5 px (arm, during wave/lean); 5 hidden samples (page scrolled back); 0 JS errors; visits 1.
Keep-out is now every visible heading/paragraph/link/button/tag/list item outside the cards, with an arm margin (max(8px, 0.08 charH) each side) in the cover guard; walk planning also treats keep-outs as obstacles.
KNOWN DEFECT: at scroll 0 on the phone the text spans the full width, so there is no text-free route or spot for her: the rest walk is refused ('no-route') and she stays off-screen until a card scrolls into view. The earlier "she rests at the bottom right at scroll 0" frames covered a text line and are superseded.
After scrolling back to the top she is hidden by the guard for a few samples, then leaves the screen (no re-seat spot).
Desktop not re-run with cache off yet.

## desktop_run (git head 2fb1f5f2, cache off, any_from_cache false, 1440x900, single run, 30 samples)
controller-box overlap while visible 0; walking overlap 0; rendered penetration while visible max 17.9 px (wave arm, in the right gutter), 5.9 to 10.5 px during lean/wave; hidden 19 of 30 samples (she rested at the bottom right at scroll 0 where keep-out text/footer hid her, then came in only after scrolling); 0 JS errors; bad GLB leaves page intact (8 cards, no canvas).
The 5 desktop PNGs in that run were captured by sample index, not by state, and do not show her: not evidence of position. Use the trace in the JSON.
