# v0.7.13 release verification — 29 October 2026

Maintainer: **Zane Dragonborn**. Live tests performed through Steam's Windows UI.
This is a record of observed checks, not Plugin Database approval or independent
tester attestation. No publishing or submission was performed.

## Exact release and environments

- Plugin ID: `dev.zanedb.ai-disclosure-filter`, version **0.7.13**.
- Installed archive SHA256:
  `6DB25935A08FD28AC8222157041113E013F46118F989369B9A0D2194BC1FE9A8`.
- Steam Stable: **1792618285**, Interface setting **No beta chosen**.
- Steam Beta: **1793235415**, downloaded through **Steam Beta Update** and
  restarted. The startup log confirms `publicbeta`; the running UI reports the
  different package build. Merely selecting a channel was not counted as a test.
- This pass covers the current user's Windows installation with other installed
  plugins present. Linux, macOS, controller input, other accounts and independent
  tester verification are not claimed.

Steam was returned to Stable after the Beta checks. The original default Light
Usage, Discovery Show All, Wishlist Show All, two exemptions, visual switches and
wishlist/owned discovery protections were preserved/restored. No test custom
filter was saved. No plugin source was changed during this compatibility pass.

## Completed observations

| Check                                 | Result and scope                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automated regression suite            | All **77 tests passed**, with no skipped tests. Includes offline provider/error handling, cache cancellation, carousel restoration, slots, lifecycle/Back handling, policy reconciliation, presets, exceptions and Wishlist fixtures.                                                                                                                         |
| TypeScript and formatting             | Passed on the v0.7.13 working tree.                                                                                                                                                                                                                                                                                                                           |
| Installed artifact                    | Hash matches the verified release; license and third-party notices are packaged as assets.                                                                                                                                                                                                                                                                    |
| Settings/Information, Stable and Beta | Both tabs open, selected state changes and the native classification rows render. No stuck loading spinner observed.                                                                                                                                                                                                                                          |
| Preference migration/persistence      | Existing default Light Usage and two exceptions survived the ID migration. Discovery Hide Disclosed persisted across the actual Beta client update/restart.                                                                                                                                                                                                   |
| Homepage discovery, Stable            | Switching Discovery from Show All to Hide Disclosed removed Call of Duty: Modern Warfare 4, Crimson Desert Enhanced and Moon Sweepers from the visible Top Sellers panel. Remaining rows reflowed without empty card slots.                                                                                                                                   |
| Search, Stable                        | Top Sellers opened with default Light Usage. It hid 15 loaded cards while retaining Moon Sweepers' translation-only disclosure. Selecting Hide Disclosed hid 16, including Moon Sweepers. Steam's own result totals remained separate.                                                                                                                        |
| Search collapse, Stable               | Header click collapsed the controls; the completed hidden count remained in the header's accessible status. Filtering remained applied.                                                                                                                                                                                                                       |
| Wishlist, Stable and Beta             | AI badge was present in release/review metadata. Options showed the compact single-label slider alongside native controls; selecting Hide Disclosed added the active Gen AI tag and removed the disclosed Dream Hackers VR entry from the accessible list. Removing the filter tag restored that entry and removed the tag. No hidden-count control appeared. |
| Settings details, Beta                | Discovery and Exemptions sections collapse. Expanding ARC Raiders' exemption displays its original disclosure. Custom editor opens with Allow/Block selectors and readable matching explanation; cancellation returns without saving a new filter.                                                                                                            |
| Store page and Back, Beta             | Moon Sweepers displays the top disclosure, expands to its translation text, and restores the disclosure after a fully loaded Community Hub page and Back navigation.                                                                                                                                                                                          |

## Issue found during live testing

**Follow-up:** v0.7.14 addresses the shared category mounting failure. See the
[category adapter report](category-verification-0.7.14.md) for root cause, scope
and newer verification. The observations below describe the original v0.7.13 run.

**Category sidebar coverage needs correction before claiming a complete release
pass.** On Beta's `/vr` page, the lower normal filterable listing displayed
Steam's FILTERS and TOP-LEVEL GENRES sections but no Generative AI section.
AI labels were visible in discovery components on that page, so this is not
evidence that the whole plugin failed to load. The currently reviewed mounting
code discovers sale/category hosts using the isolated `SALE_SIDEBAR` class in
`webview/steam/surfaces.ts`; inspecting the actual missing host is needed before
choosing a selector fix. The current observations do not establish the root cause
or whether it is exclusive to Beta.

Do not replace this finding with an automated fixture pass: offline fixtures
cannot prove that current Steam pages still match those selectors.

The Wishlist page also showed an oversized native menu graphic in its header on
both channels. Its cause has not been isolated from Steam's own rendering and
other installed extensions, so it is not attributed to this plugin or marked
resolved. The Options controls and filtering checks above still passed.

## Remaining publication checks

**Recommendation: hold the submission until the category mounting issue is
resolved and its affected live flows are retested.** This pass does not certify
complete category coverage or an unconditional Stable/Beta release pass.

The observations above must not be generalized to all categories/events or
unusual discovery layouts. Next Fest, Action FPS hover popups, every fixed-slot
replacement, a fresh disable/re-enable pass and all custom-rule combinations
have not yet been exhaustively exercised on both live channels in this pass.
The fixture suite covers several of those behaviors, but it is different evidence.

Published eligibility rules, including AI assistance and client specificity, remain
for the database maintainers to interpret. These are separate from compatibility
testing; see the [submission follow-up](submission-follow-up-2026-10-29.md).

## Channel switching reference

Use **Steam → Settings → Interface → Client Beta Participation → Steam Beta
Update**, then restart. Choose **No beta chosen** and restart to return to Stable.
See [Steam's official instructions](https://help.steampowered.com/en/faqs/view/276C-85A0-C531-AFA3).
