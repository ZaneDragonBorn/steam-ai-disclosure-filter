# Research and evidence — October 19, 2026 (America/New_York)

## Millennium

Reviewed [SteamBrew](https://steambrew.app/), [Millennium source](https://github.com/SteamClientHomebrew/Millennium), and current plugin documentation before choosing the architecture.

- [Quick start](https://docs.steambrew.app/plugins/introduction/quick-start) links to the official PluginTemplate. Inspected template commit `af0a07c7c90de902333ab5268e53ac1bf73bed36`; retained backend/frontend/webview conventions. No example icon-replacement patch was copied.
- [File structure](https://docs.steambrew.app/plugins/structure/file-structure): TSX frontend is for native Steam UI; webkit preload is for store/community browser views; LuaJIT backend supplies native lifecycle/configuration.
- [Manifest](https://docs.steambrew.app/plugins/structure/config): frontend, backend, webkit entries and compiler output. Local compiler inspection established output is a literal **file path**, hence `ai-disclosure-filter.star`.
- [Configuration API](https://docs.steambrew.app/plugins/advanced/config) plus generated SDK declarations verified reactive hooks and subscriptions. The webkit declarations expose `pluginConfig` and `subscribePluginConfig` even though older template comments suggest no Millennium API is available there.
- [Hooking API](https://docs.steambrew.app/plugins/advanced/hooking) is server-time source rewriting via backend patch declarations. Investigated but not used: this pass needs no native Steam source modification.
- [TypeScript API deprecations](https://docs.steambrew.app/plugins/ts/Millennium) rule out the old DOM/window/RPC APIs.
- Reviewed SDK configuration and browser initialization source at Millennium commit `f7a356f6789bc7d23f44bfbcdd95c71f0385cc1a`. No documented webkit unload callback was established. A cancellable controller plus backend liveness lease is implemented; client validation remains required, particularly if Millennium destroys a script context before timers can run.

Build dependency `@steambrew/starlight` is pinned to npm package 1.1.3, as referenced by the official template. The compiler's package inspection reports Starlight format v2.0 and metadata compiler version 1.1.2; those are the tool's reported values, not a claim about the installed Millennium runtime version.

## Official Steam disclosure

[Valve's Content Survey documentation](https://partner.steamgames.com/doc/gettingstarted/contentsurvey?l=english) distinguishes pre-generated and live-generated AI content. This plugin detects published disclosures only; it does not assess whether a developer should have disclosed anything.

### Structured data: primary source, verified

Steam's own store bundle, loaded by Next Fest:

[store main.js](https://store.akamai.steamstatic.com/public/javascript/applications/store/main.js?v=68ciHJXCZ8jf&l=english&_cdn=akamai)

Inspection found `StoreItem_ExtraDetails.content_survey_ai_notes` (protobuf field 17), `StoreItem.extra_details` (field 75), and `StoreBrowseItemDataRequest.include_extra_details` (field 18). These are **observed fields**, not invented API names. The bundle also contains `ai_generation_service`, which is not used as a general disclosure flag.

A direct public request to [Steam StoreBrowse](https://api.steampowered.com/IStoreBrowseService/GetItems/v1/) succeeded with the following JSON URL-encoded in `input_json`:

```json
{
  "ids": [{ "appid": 1808500 }, { "appid": 620 }],
  "context": { "language": "english", "country_code": "US" },
  "data_request": { "include_extra_details": true }
}
```

Observed `response.store_items` results:

| App | Identity / result | Disclosure evidence |
| --- | --- | --- |
| ARC Raiders, 1808500 | `item_type: 0`, matching `id` and `appid`, `success: 1`, `visible: true` | Nonempty `extra_details.content_survey_ai_notes`; matches the official HTML disclosure |
| Portal 2, 620 | Same successful identity structure | `extra_details` present; notes omitted; no disclosure section in HTML |

No account cookie, access token, or Web API key was supplied. Sending `Origin: https://store.steampowered.com` returned `Access-Control-Allow-Origin: https://store.steampowered.com`, JSON content type, and `X-eresult: 1`. This supports direct anonymous fetch from a store webview; actual Millennium isolated-world/CSP behavior remains untested. The provider falls back to same-origin HTML if the API cannot be used.

This is a reverse-engineered Steam endpoint, not a documented compatibility guarantee. Only two app samples were compared. A missing notes field in a valid details object is interpreted as *no disclosure found*. Missing details or failed identity/result validation is unknown. API field removal would need detection with additional canary fixtures in a later pass.

The implementation currently requests one App ID at a time. The two-ID research request confirms batching is technically possible; a future shared broker can batch without changing the provider interface.

### Other sources investigated

- [Store appdetails sample](https://store.steampowered.com/api/appdetails?appids=1808500&l=english): inspected keys and values. No AI field; `content_descriptors` was `{ "ids": [], "notes": null }` despite a visible AI disclosure. **Do not use that field as an AI flag.**
- Next Fest server HTML is a JS application shell. It does not directly contain the rendered game cards. No disclosure inference is made from its app lists, tags, artwork, or review text.
- Client-private native interfaces/authenticated data were not exercised because Steam was not running. The public structured route removed the need to invent such an integration.
- No documented public Steam Web API contract guaranteeing this disclosure field was established. The observed StoreBrowse schema and response provide the current basis.

### HTML fallback: verified

Fetched [ARC Raiders](https://store.steampowered.com/app/1808500/?l=english) and [Portal 2](https://store.steampowered.com/app/620/?l=english) anonymously. ARC Raiders has a `div#game_area_content_descriptors` with a direct `h2` whose text is `AI Generated Content Disclosure`. Portal 2 lacks that section.

The parser requires the expected canonical/OG App ID, `#appHubAppName`, and a full `#game_area_description`. It rejects detected age-check forms, mismatched redirects, failed HTTP responses, and unexpected content types. Only the direct heading in the official descriptor container is a positive. Negative findings require the expected English About heading. Duplicate descriptor IDs are handled with `querySelectorAll` because the same container ID can describe mature content. Unknown means visible.

Rate limits for these storefront routes were not established. Limits/backoff are documented in the README. No automatic immediate retries, credentials, age cookies, or third-party servers are used.

## Next Fest card evidence

Opened the [current Next Fest page](https://store.steampowered.com/sale/nextfest?l=english) in a browser, selected Charts (`tab=23`), and inspected rendered markup. This was a browser inspection of Steam's page, **not the Steam client**.

Observed nesting:

```text
.sale_item_browser
  .StoreSaleWidgetOuterContainer
    .ImpressionTrackedElement
      ... a[href="https://store.steampowered.com/app/<id>/..."]
            .CapsuleImageCtn > img
      ... a[href="https://store.steampowered.com/app/<id>/..."]
            .StoreSaleWidgetTitle
```

The current adapter matched 50 containers. Samples included App IDs 4736580, 3218230, and 3012110. The first was a demo link whose capsule artwork URL contained parent App ID 3797790. Link identity wins; image URLs are never used to classify a card. No parent relationship is inferred.

The rendered sale lists are outside `#application_root`; that root is not used as a selector constraint. Obfuscated CSS hashes are intentionally excluded. Only the observed item-browser card shape is supported; this is not coverage of all Next Fest carousels or discovery panels.

## Verification boundary

Automated tests use reduced synthetic DOM structures matching the inspected card shape. Downloaded raw research responses are local ignored files under `.research/`; no entire third-party page is shipped. Parsers were also run manually against the actual downloaded HTML/JSON responses and returned positive for 1808500, negative for 620. Native Steam integration and visual collapse behavior remain the next validation gate.

## October 20 update: storefront controls and additional surfaces

Inspected rendered public Search, Next Fest, VR, and Trains pages. Search uses `#additional_search_options` for filters and `#search_resultsRows a.search_result_row` for cards. Next Fest, VR, and Trains use `.sale_item_browser ._1tOSyFfIWM42bIEwzvMp8v` as the observed filter host. Unlike the original card adapter, the sidebar adapter must currently use an obfuscated class; this supersedes the earlier statement excluding all hashes. It is isolated and may break on Steam updates.

VR and Trains lazy-load `.sale_item_browser .LibraryAssetExpandedDisplay` grids with app links, `.ImpressionTrackedElement`, and `.HeroCapsuleImageContainer`. The implementation requires a single distinct app-link ID per wrapper. It does not generalize top-of-page carousels from this evidence. This inspection was in a browser, not Steam.

The observed `StoreItem_ExtraDetails_AIGeneratedContentService` schema provides service name/URL. No dependable per-game taxonomy for artwork, voices, writing, or quality was established. Therefore Custom matches user-entered literal phrases only in official disclosure notes. Always-show exceptions let users retain selected games without inferring quality. Valve's survey distinction between pre-generated/live-generated content does not establish that those categories are available as public response fields.

Millennium's [frontend globals source](https://github.com/SteamClientHomebrew/Millennium/blob/main/src/typescript/frontend/utils/globals.ts) determines configurability from registered native sidebar renderers. The reported message is consistent with an absent renderer, not proof that a manifest flag is missing. The native registration failure was not reproduced. No private registry manipulation was added; storefront controls use the documented webkit configuration bridge independently.

Version 0.2.0 passes 14 automated tests, SDK typechecking, and Starlight packaging. Actual client rendering, configuration delivery, CORS/CSP, and disable/re-enable still require runtime testing. Synthetic DOM interaction tests do not establish end-to-end Steam compatibility.

## 0.3.1 runtime correction and 0.3 feature update

Steam's live log identified the 0.3.0 startup failure as `module 'cjson' not found` at backend/main.lua:3. SDK declarations are not proof of availability in an installed runtime. Removed the dependency and passed history as a table through the generated FFI bridge. After installation, Steam logged `AI Disclosure Filter loaded` at 23:12:50 local time. Full frontend/settings behavior remains unverified.

The installed configuration also revealed a malformed key named after the plugin ID, with value `revealUntil`, while `mode` remained Off. The official Starlight compiler's `starlight/src/bundler/transforms.rs` injects pluginName into configuration API calls. Removed explicit IDs from imported config calls/hooks and cleaned up the malformed setting in backend startup.

Live public `/tags/en/Souls-like/` rendered the same sale item-browser sidebar and cards after scrolling. The old URL allowlist excluded tags. Component matching now controls coverage, excluding app/account/checkout-like paths.

A fresh two-App-ID StoreBrowse request returned ARC Raiders disclosure notes and Portal 2 without notes, plus `reviews.summary_filtered.review_count` and `percent_positive` when requesting `include_reviews`. These fields drive simple history ranking. Reduced response fixture is in tests/fixtures/storebrowse.json.

Disclosure research: [INORIGAMI HACK DOWN](https://store.steampowered.com/app/4399160/) explicitly limits generative AI to translation; [AQUA FALL](https://store.steampowered.com/app/4718380/) describes localization with developer review. Other examples combine concept art, music, marketing, and other uses, so pre-generated or human-reviewed is not a reliable minimal-use category. Light Usage uses a conservative explicit translation/localization-only text rule, not a Valve taxonomy. It deliberately misses some equivalent wording and does not infer that ARC Raiders' vague disclosure is light usage.

The serial 1.5-second queue, near-viewport gate and 120-ID ceiling are superseded by two concurrent 40-ID batches, automatic loaded-card checks and a four-request HTML fallback limit. Unknown results retry after 30 seconds subject to provider cooldowns. These changes are tested with fixtures but live Steam performance remains to be measured.

## October 21: live browser transport and filtering verified

The default fetch function was stored on provider instances and invoked as a method, supplying a provider object as the browser receiver. Bound it to globalThis in both structured and HTML providers. Receiver-sensitive regression coverage now tests this path. Added warning logs for failed retrieval and changed sidebar status to report unresolved results rather than Complete.

In the real Steam client, a temporary local trace recorded 100 loaded search cards, zero unresolved results, and positives including 1808500. Selecting Hide Disclosed hid 19 cards; ARC Raiders disappeared from both screenshot and accessibility tree. Selecting Light Usage restored ARC Raiders and left 12 cards hidden. Detection history and review metadata successfully reached Millennium configuration through the table FFI bridge. The temporary trace is removed from the shipped code/config. Local proof screenshot: .research/verified-hide-disclosed.png.

Per the user's explicit preference, Light Usage now permits the entire normalized development-assistance statement currently published by ARC Raiders. It is a text rule, not a game-ID exception or a general inference that human review makes AI minimal. Hide Disclosed continues to hide this statement. Broader disclosure wording remains conservative.

## 0.4.0: UI polish, exception input, and listing badges

Preserved provider/cache/filter semantics. Sidebar now uses a header status dot with accessible hover text, a Steam-blue filled range and a single current-preset label, a divider, and title search across saved/current detected history. Sale/category controls use a smaller expandable header. Collapse state survives host replacement within the same view and does not alter settings.

Native settings group detected history under one heading, add search, and accept validated numeric App IDs as exceptions. Tested in the real Library Manager: manually added App 620, confirmed it persisted in allowedApps, then removed the temporary exception and confirmed the original empty exceptions list. Long disclosure notes are expandable so titles and actions remain scannable. A subsequent layout adjustment stacks inputs/actions for narrow settings panels.

Badges reuse isLightDisclosure rather than introducing a new classifier. Labels are Light Usage and Other Disclosed Usage. Other means outside the current narrow Light rules, not an authoritative heavy-use/quality assessment. Search badges were visually verified next to ARC Raiders (Light) and ARC-9 (Other); their accessibility descriptions included rule context and official notes. Other supported card adapters use the same marker controller, with corner placement if no observed title container exists. No new discovery endpoints or calls were added.

26 automated tests cover the original behavior plus App ID validation, status tooltips, title search beyond the first 40 entries, collapse state, badge uniqueness/recycling/cleanup and tier parity. Package/typecheck succeed. Local visual evidence: .research/v040-search-badges.png.

## 0.5.0: contextual categories, page scope and native integration

Inspected current Search markup and its searchpage.js `InitAutocollapse`: native blocks use `.block_header.labs_block_header` and call `slideUp/slideDown('fast')` on their contents. The plugin uses the same page jQuery animation without joining Steam's preference-backed `search_collapse_block` initialization (which would double-bind its header). Current script: https://store.akamai.steamstatic.com/public/javascript/searchpage.js?v=ZaKXv_bZeHHl&l=english&_cdn=akamai . Search status used CSS cursor:help; changed to default to remove the OS question-mark cursor.

Public action_fps category inspection after loading the listing established native group `._3aX5FdS6RjfaN8MCACBPf5`, 16px/500 uppercase header text, and `.ReviewScore` inside a dedicated metadata row on expanded cards. Category controls insert before a native group and use in-body status; badges append to review/title/price metadata and skip unknown hosts instead of falling back to a control-area corner overlay. Hashed selectors are isolated in surfaces.ts.

Current-page card detections now supply storefront reviews; persistent history only resolves exemption names. Hidden inactive Steam panels are excluded while plugin-hidden and offscreen loaded cards remain included. Native settings remove permanent history/search and provide Exemptions plus named custom filter management. Config uses the existing plugin-bound bridge; no additional API calls were introduced.

Five primary local usage classes replace Other: Light, Audio, Content, Interactive, Heavy; Unclear remains an explicit fallback. Clause negation/reference context and breadth are considered. The current THE FINALS disclosure has the established development-assistance statement followed by a limited commentator TTS example (https://store.steampowered.com/app/2073850/THE_FINALS/). Per the requested policy it is Light with an Audio facet; ARC Raiders' statement remains Light. This supersedes the historical narrow Light description above. Rules are deterministic English interpretations rather than official Steam categories or comprehensive semantic understanding. Product preset descriptions contain no game names.

Typecheck and 30 tests validate rules, named any/all matching, scope, observed Search animation calls and existing regressions. Native Search collapse and new labels were observed; Library Manager rendered Exemptions and the custom editor. These checks do not establish every category/compact layout or a full saved-filter interaction cycle in the real client.

Additional live 0.5.0 check: VR's shared listing sidebar displayed Generative AI between the tag search and native filter groups, with ordinary completion/hidden-count text inside. Clicking its header collapsed the controls and kept a compact heading beside VR Only, Top-Level Genres and the remaining groups. Final 39.55 kB build installed successfully and Starlight reported the plugin restarted. Expanded-card badge placement remains based on the inspected dedicated review row and automated tests; this client check did not encounter a disclosed expanded VR card.

## 0.6.0: blocked review, full header target and filter ordering

Reviewed the supplied 24.93-second local recording with one-second samples throughout, plus enlarged header-region samples around seconds 1–15. Native Price collapses to its header with no arrow; the old plugin left separate title/status targets and an extra selector. Search now has a single non-selectable header button containing title and status dot, keeps the observed native fast slide behavior, removes its arrow, copies the adjacent native header colors/type and removes the redundant storefront dropdown. Category spacing is reduced and its normal status now uses a small colored pill. Existing card badge placement is unchanged.

Quick review is now Blocked titles, computed from the same shouldHide policy as the controller for current-page authoritative positives. Show All is empty, and exempted games do not appear. Persistent exemptions are managed in Library Manager rather than duplicated in quick review. Its information button explains the settings path and App ID management. Saved exemption rows again include the original saved disclosure; manually added unknown IDs explain when no saved text exists.

Filter order is separate from custom definitions. Built-ins and named filters share a validated persisted order, with Show All always first. Stale/duplicate IDs are discarded and missing/new modes append without deleting custom definitions. Dragging uses a pointer-captured handle: the first native test found Steam's CEF did not deliver HTML drag/drop events. Keyboard Alt+Up/Down is also available. Custom editor usage controls now say Allow/Block, explain each type, and describe Either rule can block versus Both rules must match in ordinary language. Allow is explicitly not an exemption.

Classification review found generic in-game assets/content absent from Content recognition. Added those affirmative terms without inferring Heavy. Official Steam Call of Duty listings use this asset wording (https://store.steampowered.com/app/4085040/Call_of_Duty_League__Miami_Heretics_Team_Pack_2026/). MapleStory's indexed official disclosure describes player-created character illustrations and translation (https://store.steampowered.com/app/216150/MapleStory/); the direct page was region-unavailable to the web reader. Player illustration generation now maps to Interactive with a Content facet, and explicit AI context may carry into a separately stated feature. Translation alone remains Light. Negative claims and vague tool-only statements remain distinct. These are plugin interpretations of disclosed uses, not Valve categories. Live All Products confirmed Call of Duty as Content and MapleStory as Interactive.

35 tests and TypeScript checks pass. The native client confirmed header collapse through the status area, expansion, clean tooltip, no extra selector, Show All's empty blocked list and PUBG's restored disclosure in settings. Existing custom definitions and the saved PUBG exemption remained present through install/reload. Broader language, layout and rapid-navigation coverage remain ongoing work.

Final native drag verification: with pointer capture, dragging Hide Disclosed above Light Usage reordered the real Library Manager list and wrote filterOrder to Millennium configuration. Dragged it back to restore the user's original order; Show All remained first. The existing default, PUBG exemption and two named custom definitions were preserved. Final installed and locally verified artifact size: 42.66 kB.

## 0.6.1: approved wording, loaded-result count and quick exceptions

Applied the user's exact approved/replacement descriptions from the sequential copy review: custom introduction, four built-in presets, named-filter description, editor introduction, matching rules, phrase-entry help, default-filter/exemption help and management info. AI usage descriptions remain approved; Light uses the reviewed description. No filtering/classification rules changed.

Public Search inspection confirmed `#search_results_filtered_warning_persistent` contains Steam's own totals and preferences action. The plugin inserts a separately labelled sibling beneath that block, reporting only additional hidden cards in loaded results. It never rewrites or subtracts loaded cards from Steam's global totals. Counter mounting handles AJAX replacement/removal and plugin cleanup. It reuses the controller's hidden-card count without new requests.

Restored a separate Exceptions chip list beneath Blocked titles on compatible storefront sidebars. Names come from current detections or saved history; unknown IDs remain identifiable. Each × button removes only its own App ID using the existing configuration bridge. Blocked-title search remains page-specific and does not filter the persistent Exceptions list.

Current public action_fps markup established native header `._3nsXKzSSkXGctsyIBw1RIF`, title `._3X8r5nTmkQJqI-YG8Vl91b`, title opacity .7 at rest/.85 under hover, and the SVG polygon/viewBox used for the down/right chevron. The plugin now reuses those header/title classes and SVG geometry, replacing the Unicode arrow and brightening-to-white treatment. These observed class hashes remain isolated in surfaces.ts.

38 tests pass with TypeScript checks; local package verification passed and Starlight reported successful installation/restart of v0.6.1 (44.17 kB). New regression checks cover unchanged Steam totals, summary remount/cleanup, persistent exceptions independent of blocked search, removing one exception, and native category header/SVG integration.

Post-install native Search verification: approved Show All and Hide Disclosed descriptions rendered correctly. The restored Exceptions section displayed the user's three saved exemptions as named chips with × controls. Selecting Hide Disclosed hid 11 loaded cards and the separate summary immediately reported 11 while Steam's global result/preference numbers remained unchanged; Show All was restored afterward. No exemptions were removed during this check.

Final native category check on action_fps: the Generative AI title and down chevron matched the surrounding Top-Level Genres treatment, with the approved Show All description and colored completion pill inside. Confirmed the card descriptor remains beside review metadata. Clicking the category header collapsed its contents and rotated the native-shaped chevron toward the right.

## Shared discovery adapters — 2026-10-22 (0.7.0)

Inspected the live public Next Fest, action_fps, homepage and Top Sellers US DOM. Next Fest has the same `._1tOSyFfIWM42bIEwzvMp8v` filter sidebar and `.LibraryAssetExpandedDisplay` cards without `.sale_item_browser`. Its sidebar parent contains the associated listing. This is the missing wrapper assumption fixed in this release. Support follows the shared component, not event/category URL names.

Homepage legacy components observed: `a.store_main_capsule` with `.review_summary_row` / `.app_name`; artwork-only `a.sale_capsule`; `a.tab_row_item` with `.tab_item_title`. Charts use one-App-ID `tbody tr` rows containing `.StoreSalePriceWidgetContainer`, with title metadata in the third cell. Multi-App-ID containers are rejected. Chart ranks are not rewritten.

The action_fps discovery shelves use `[data-key="hover div"]` wrapping `.CapsuleImageCtn`, including a native `[popover]` with `.ReviewScore` / `._3WlfumeMCR40WR-uBdg3Gx` metadata created during hover. A public browser right-click over a capsule exposed that existing popup without navigating. Labels are restricted to popup metadata for these compact cards. The spotlight card uses `._3hxg83PMgvZaOaB_-m0mXX` and `._3yPJAYRckrGOYnsQF9nnMD` metadata. Hashes are observed and may need maintenance after Steam updates.

Steam's public legacy main.js `GameHover` creates `#global_hover_content > #hover_app_<id>`; apphoverpublic/1808500 returned `.hover_title` and `.hover_review_summary`. The plugin decorates these existing app-specific containers, without changing Steam hover behavior or creating its own hover requests. Legacy and React hover lifecycles have regression coverage.

The official current bundle maps ds_wishlist_flag to `._3Rgc5idc13zGnjAaIpVNAR`. Legacy `.ds_wishlist` and semantic `.ds_wishlist_flag` are also recognized. `.SaleSectionCtn .SaleSectionHeader` identifies dedicated On Your Wishlist shelves. No wishlist membership is guessed for unmarked cards; delayed or changed flags are a known limitation. No extra discovery exceptions were added.

The native category header uses align-items: normal with a 10px top margin on its SVG; centering our header as well as inheriting that margin displaced the arrow. The category-specific centering override was removed. Search retains its arrow-free full-header button.

41 tests pass, including independent discovery/list policies, preserved wishlisted cards, configurable wishlist filtering, shared phrases, hover decoration/recycling and no artwork overlays. Native settings inspection confirmed both selectors, default discovery Show All, wishlist Keep visible, shared Custom editor, and existing exemption disclosures. A narrow settings layout exposed row-flow children; both selector/description pairs were corrected to explicit column stacks before final rollout.

Live client verification: Next Fest → Charts injected the Generative AI group alongside native filters. Selecting Hide Disclosed immediately changed the completion pill to four cards hidden and listed blocked titles, including Never Be Alone Demo with its official notes. Returning to the original Custom preset restored the cards. No exemptions or custom phrases were changed. Final local package verification reported all four sections valid; Starlight installed/restarted 0.7.0 (46.86 kB).

After final hot reload, native Library Manager confirmed both selectors occupy full-width rows with their selected-mode descriptions below in the same card. The shared Custom phrase field, Keep visible wishlist default, and Rescan action render correctly in the narrow drawer. Existing default Custom and exemptions were preserved. Live end-to-end filtering verification for this pass was Next Fest Charts; homepage/category/chart component coverage additionally used public DOM inspection and automated adapter fixtures. This is not an exhaustive live-client check of every discovery experiment or signed-in wishlist layout.

## Revision 0.7.1 — 2026-10-22

Removed the native settings Rescan section. Storefront refresh now sits beside the slider, is labelled exactly Refresh filters, and rereads current config without clearing cached disclosures or resetting the current preset. Review information is inline beside Review disclosures & exceptions again, with the detached tool row and top divider removed.

Grouped Default AI Filter and its shared Custom phrases together, followed by a separate Discovery group containing its default mode and native DialogCheckbox exemptions. Asked the user which additional exemptions to include; they selected Owned games. Added that checkbox only (unchecked by default), alongside the existing default-on wishlist checkbox. Ownership uses the observed Steam ds_owned / ds_owned_flag and current _1Ywwc4rP-p7ADlRoCRtVUb marker. No installed-game toggle or unrelated exception types were added.

Exemptions and Custom filters now use keyboard-accessible details/summary containers. Each exemption disclosure starts collapsed, while removal remains available independently. Native Steam verification confirmed both section headings collapse and both discovery checkboxes render.

Inspected the current homepage DOM and found its newer discount/spotlight card wrapper _229f53fK_tl7R6wqc-g2bq, with anchor _2V8zu-797jsZm1qtHNFXhS and price metadata bar _1-29ksrfQaORRCqN2AVf06. These were missing from the previous scanner. Single-app cards now prefetch, label the metadata footer, and use discovery policy; event/bundle promotion wrappers without a single app link remain untouched. Right-clicking one current homepage card exposed the existing legacy #global_hover_content > #hover_app_<id>, confirming its hover adapter can reuse the prefetched result.

Inspected Next Fest expanded cards and observed the shared _1_ehE8jTqsTDnx5E7Sqjy7 release/platform footer. Compact cards use CapsuleBottomBar as well. Labels can now occupy the left of that metadata bar, beside release/price details, and independently appear in existing hover metadata. Expanded no-review cards prefer this footer over a nested price widget. Badge tracking supports both footer and hover markers and removes stale markers when hover content is recycled. Artwork and wishlist controls are not used as label hosts.

43 tests pass plus TypeScript/package checks. Added regressions for actual current homepage wrapper/footer classes, promotion rejection, release/footer labels, simultaneous hover/footer markers, discovery Show All/Hide transitions using cached results, opt-in owned exemption, late ownership-flag changes, and keeping ownership exceptions out of normal search policy. Live Steam homepage showed AION 2 with AI - Content beside reviews. The grouped native settings, phrase placement, checkboxes, collapsed disclosures, and both collapsible sections were inspected in Steam. Discovery mode was temporarily changed for testing; current user-selected settings are left intact.

Final adapter refinement: single-app recommendation anchors can also be found structurally from the observed shared release/platform footer plus capsule image, without requiring a legacy wrapper. Ancestors already handled by other adapters are excluded to avoid duplicate cards. A regression covers that fallback, expanded-card deduplication, and rejection of sale promotions. Final suite: 44 passing tests. TypeScript and package verification pass; final package is 0.7.1, 47.69 kB.

## Post-0.7.1 stability review and coverage — 0.7.3

The intervening 0.7.2 work added personalized legacy shelf adapters and a carousel presentation helper. Reviewed that code before expansion. Kept the shared adapters, but guarded optional native helper methods, bounded repeat advance attempts, cleaned stale state after carousel replacement, preserved non-app promotions in paged groups, and replaced the reserved empty-carousel area with a collapsed local presentation. Tests cover helper exceptions, restoration and all-blocked states. No Git baseline exists in this untracked workspace, so this review used the source changes and earlier recorded 0.7.1 scope rather than claiming a commit-to-commit diff.

Inspected current public Steam home.js and main.js URLs already recorded above. CGenericCarousel keeps original arrays/indices and GetNextValidIndex skips display:none items for forward/back navigation. Featured & Recommended uses GHomepage.MainCapCarousel; other legacy paging_capsules shelves have native arrow handlers. Filtering now advances a blocked focused card through those handlers, without splicing Steam arrays or removing nodes. Native helper access is optional in isolated preloads.

Live public DOM inspection on category/action_fps found data-key="hover div" capsules inside ImpressionTrackedElement, capsule_index slots, and an outer grid cell (_3r4Ny9tQdQZc50XDM5B2q2) directly beneath SaleSectionContainer. Hiding only the inner capsule left that grid cell. The reusable slot adapter hides a direct cell only when every linked element is inside a blocked card, and collapses an entirely blocked group. It also handles the homepage promotion grid _3gVAXLzTzt5xCjFA1_c9rn. A mixed sale/event link prevents hiding the encompassing group. Native grid placement remains automatic; no artwork/wishlist placement changes were made.

The homepage promotion carousel uses carousel__slide, carousel__slider-tray (percentage widths/transforms), carousel__dot and carousel__dot--selected from its existing React carousel library. Removing/reordering slides would invalidate those indices. A separate bounded adapter skips a fully blocked page using the next available existing dot handler and hides blocked page dots; it leaves the tray geometry and React nodes intact. Unknown or promotion-containing pages are retained. Entirely blocked carousels collapse locally and restore when policy changes.

Action FPS's actual hover popup is [popover="manual"], with app links, ReviewScore and metadata _3WlfumeMCR40WR-uBdg3Gx. Nested popups retain the existing badge placement; portalled popups now resolve their own single App ID independently. Recycled href changes remove stale badges. No identity is inferred from pointer position. Added the observed single-app category feature anchor Ay0ys40M1NtzbqyKeNgwX; no category URL allowlist was added.

Confirmed Active Matter (2887580) through the official StoreBrowse API with include_extra_details: success=1, visible=true, matching id/appid, and content_survey_ai_notes describing generated voice. The same authoritative result drives all supported cards. Saved config at review time was discoveryMode=off, defaultMode=custom, with an empty phrase list, so those policies correctly permit disclosed games; no filtering policy was silently changed as a code fix. Wishlist/owned/explicit exemptions remain independent.

Automated verification: 55 passing tests and TypeScript check, covering the new layout/hover/carousel cases alongside the prior suite.

Live verification exposed two additional issues that fixtures alone missed. First, a Steam page retained its old discovery policy after Library Manager saved a change; refreshing the page picked up the new value. Kept subscribePluginConfig as the primary API, and added a compact Lua filterState FFI snapshot to the existing backend lease every three seconds. It reads only policy keys through millennium.config.get, excluding detected history. Revision checks reject snapshots overtaken by config notifications/local writes. Reconciliation changes the current slider only when the default itself changes. No additional Steam HTTP traffic is generated; disable cleanup now takes approximately seven seconds at most under normal timers.

Second, the Action FPS popular-title carousel groups a two-card and a three-card SaleSectionContainer under HlkukqE4fB5si76sBJzKX on each indexed slide. Removing a large card still left half a row unused. When such a verified page loses a cell, CSS display:contents flattens only those rows into a responsive three-column grid. Nodes and React page indices remain untouched. Native verification confirmed Rust, Overwatch and GTA occupy the first packed row with Arena Breakout below; restoring Show All restored Modern Warfare/Rust's original larger first row without a page refresh. Added a regression for this layout restoration.

Native Steam verification confirmed Active Matter's AI - Audio badge beside featured reviews and Modern Warfare's AI - Content badge. Hide Disclosed removed featured entries/dots while allowed previews continued cycling, and Action FPS's popular-title discovery grid removed the disclosed card and packed its remaining cells. After restoring Discovery to Show All through Library Manager, the already-open category restored Modern Warfare and the original layout automatically, confirming the policy fallback works. Its actual game hover popup displayed AI - Content under the review/platform metadata; the badge's tooltip uses the same official notes as the card. Default Custom, empty phrases, explicit exemptions, wishlist-on and owned-off settings were preserved/restored.

Final installed build: 0.7.3, 51.31 kB. Verification covered the live Steam homepage and Action FPS category, plus public DOM/source inspection on homepage, category and Next Fest Charts. Next Fest/public sale and portalled-popup behavior additionally have shared-component regression coverage; this is not a claim of exhaustive live testing of every Steam page, experiment, virtualized list or responsive carousel breakpoint.

### Final polish: 0.7.4

Investigated calendar/recommendation gaps. The old wishlist fallback searched every descendant heading of the closest home_page_content; that container can contain unrelated homepage shelves. Narrowed legacy heading detection to direct shelf headings and retained the dedicated SaleSectionCtn/explicit wishlist flags. A nested wishlist shelf no longer exempts unrelated calendar cards.

Added a structural capsule fallback: an app hyperlink containing official Steam CDN header/capsule/library artwork for the same App ID. Existing recognized components take precedence. Navigation, editorial takeover banners, mismatched artwork and mixed-app containers are excluded. Simple single-child card wrappers can collapse reversibly; indexed carousel/page adapters retain their existing handling. Background-only and unknown virtualized layouts remain limitations rather than speculative selectors.

The public personalcalendar page requires Steam sign-in, so public DOM inspection could not verify the personalized content. Native signed-in Steam verification did: with Discovery Hide Disclosed, Online:404 and Modern Warfare were absent from the homepage calendar. Switching to Show All restored Online:404 above the remaining Wednesday card and Modern Warfare/A.S.P.I.S. in Friday's column without refreshing. Hide Disclosed was restored after comparison. Date headings remain in place intentionally, while remaining game cards pack within their own dates. Existing wishlist and explicit exemptions were preserved.

Inspected MapleStory's official public app page: #glanceMidCtn contains the top information card; #appHubAppName and canonical/og:url identify the app. The page repeats game_area_content_descriptors for mature-content and AI sections, so only the section whose direct h2 is AI Generated Content Disclosure is authoritative. Reused that exact extraction in both HTML lookup and the new read-only StorePageDisclosure component. It displays original disclosure text and the existing classification in a collapsible panel, uses the existing cached provider only when local HTML is inconclusive, and never filters the opened game page.

Native Steam verification on Modern Warfare's app page confirmed the collapsed AI - Content panel beneath the top metadata/tags and its expanded original AI disclosure text. The homepage calendar hover also retained its AI - Content badge near review metadata. Original policy at this pass was default Custom with empty phrases, discovery Hide Disclosed, wishlist protection enabled, owned protection disabled, and exemptions 1808500/2073850; all restored/preserved after tests.

Validation: TypeScript passes; 59 regression tests pass, including new dynamic calendar-card detection, matching-artwork identity, wrapper restoration, scoped wishlist protection, positive/negative app-page identity and disclosure extraction, panel remount/cleanup and expansion preservation. Local and installed Starlight packages are v0.7.4 (53.07 kB); compiler output remains auto. This does not establish coverage for every personalized Steam experiment or virtualized layout.

### Settings, FAQ and category gaps: 0.7.5

Public Role-Playing category inspection confirmed the same SaleSectionContainer two/three-card grids and HlkukqE4fB5si76sBJzKX page wrapper as other categories. Existing reversible compaction remains applicable. Its VideoRow is different: a shared _3hxg83PMgvZaOaB_-m0mXX featured video/info grid sits between two navigation elements. Hiding that feature alone leaves the arrow row empty. Added a replacement for that observed shared structure only, retaining original game nodes, arrows and Steam selection; it explains that the AI filter hid the title and directs the user to Discovery settings. It is removed on restoration/recycling/cleanup. No category-name allowlist or new broad grid rewrite.

showAITags and showStoreDisclosure are independent persisted preferences, default true, transported through the existing config subscription and local policy lease. Tags cover card/hover badges and the game-page classification badge; the game-page disclosure section can remain without its badge. The section can also be disabled separately. Neither preference changes shouldHide, provider requests, exemptions or selected presets. Settings keeps its mounted form when switching to the brief FAQ view, preserving unsaved edits and collapsed sections.

62 tests pass, including visual toggles with active hiding and cached results, independent game-page preferences, policy reconciliation, and replacement uniqueness/restoration/recycling without altering navigation. TypeScript passes. Installed and verified v0.7.5 (55.13 kB).

Native Steam verification: both visual preferences appear immediately above Discovery; Discovery collapses, and its collapsed state survives switching to FAQ and back. FAQ fits in the panel and shows all six explanations and Discovery limitations. Disabled both options, confirmed MapleStory's search row has no tag and its opened game page has no added disclosure section, then restored both defaults. The already-open MapleStory page recovered its Generative AI disclosure / AI - Interactive panel without reloading. Original Custom default, empty phrases, Discovery Hide Disclosed, wishlist-on, owned-off and exemptions were preserved. The category feature replacement has automated restoration/navigation coverage against the observed RPG structure; this pass did not encounter a blocked live RPG feature for visual confirmation.

### Replacement consistency and selected tabs: 0.7.6

Compared current public FPS, RPG and Adventure category DOM. Each uses a ten-slide pure-react-carousel without carousel__dot nodes; the slots retain percentage widths, with padding-bottom/height unset and the inner slide position unset. The previous dot-based skip adapter deliberately does not mutate those tracks, but the replacement only handled a direct VideoRow feature, leaving a fully blocked panel blank. Added replacements inside fully blocked indexed slides without changing track geometry. Fixed-height slides with absolute inner content use an inset replacement; flowing category slides reserve normal replacement height. Partial grids retain existing compaction. All links must be blocked, with at least one authoritative app link; unknown and promotion links prevent replacement.

Featured VideoRow replacements now support intervening wrappers and sit outside the hidden wrapper. Replaced panels take precedence over nested feature replacements to avoid duplicate messages. Replacements recover if Steam removes their DOM, and disappear when a policy/exemption permits any game again. Regression tests verify repeat scans, restore/recycle, mixed panels, promotion preservation, indexed widths/transforms and original navigation nodes.

Settings/FAQ navigation now has tablist/tab/tabpanel semantics, aria-selected, a contrasting active background and blue underline, with roving keyboard focus and Left/Right/Home/End navigation. The settings form remains mounted during FAQ navigation. TypeScript passes; 65 regression tests pass.

Installed and verified v0.7.6 (56.13 kB). Native Steam clicks confirmed the active underline/background switches from Settings to FAQ and back; saved policies, visual options and exemptions remain intact. Category verification used current public FPS/RPG/Adventure DOM plus automated blocked-panel scenarios; this is not exhaustive live coverage of every personalized category or scrolling panel.

### Cached Back/Forward restore: 0.7.7

Reproduced in native Steam on Online:404 (4094350): reload showed the top disclosure, navigating to Community Hub then using Back returned the game page with the disclosure missing. The existing preload called irreversible stop on pagehide, removing the panel, styles, observers, configuration subscription and popstate listener. A cached document restore does not rerun that preload.

Added a shared page lifecycle manager. Persisted pagehide disposes the current session; persisted pageshow creates one fresh session with current configuration and observers. Initial/nonpersisted pageshow and duplicate restore notifications do not duplicate sessions. Final navigation removes lifecycle listeners. Session cleanup is idempotent, and stopped sessions ignore delayed settings callbacks. This fixes the shared lifecycle rather than remounting only the disclosure and leaving listing filtering stopped.

67 regression tests and TypeScript pass. New tests exercise repeated cached restores, restored disclosure observers after metadata replacement, current visual preferences, list hiding and dynamically loaded cards after restore, and permanent cleanup.

Installed package verified as v0.7.7 (56.35 kB). Native post-install verification repeated Online:404 → Community Hub → Back: the disclosure panel returned without reloading, and expanding it displayed the original voice-generation disclosure. This reproduces the generic leave-and-return trigger without requiring a particular review/comment. Current settings were preserved: default Light Usage, Discovery Show All, AI tags disabled, game-page section enabled, wishlist and owned protection enabled, exemptions 1808500/2073850. Steam required a manual reopen after the build; the user reopened it before the successful live check.

## Wishlist and desktop tab correction — 0.7.9

Inspected Steam's current public Wishlist SSR page and the signed-in client in expanded/compact views. The public route bundle was Cd8kGth4.js under Steam's store/ssr CDN at investigation time. Options is a native form containing viewmode/platform radios and section headings. Detection follows those field names, not translated labels. Row content uses PE-3oq-yIvg- and title metadata uses P-zVPa2bdmQ-, inside PLkUpk974nY- and an indexed virtualizer row. These hashes are isolated in steam/wishlist.ts and may change after updates.

Steam's Lh list component explicitly enables dynamic sizing (bDynamic:true), measures contentRect.height/getBoundingClientRect().height and passes fnRender plus the original item count. The signed-in rank/order view additionally uses virtual drag/drop indices. The adapter therefore retains rows, indices, ordering handlers and ranks, and collapses the entire measured row locally. It never modifies the Wishlist response, account membership, native sort or Steam's preferences. The generic artwork fallback and outer-slot compaction are bypassed on Wishlist so they cannot hide only thumbnails or an entire virtual track. Only rendered rows are requested; subsequent virtual rows are processed as inserted. Native drag interactions require continued coverage across Steam experiments.

Wishlist Options receives an additive Generative AI group with shared presets, descriptions and status. Events originating in that group do not reach Steam's native filter form. wishlistMode is independent, defaults to Show All and persists through Millennium; it shares Custom phrases/explicit exemptions. Discovery wishlist/ownership exemptions apply to discovery shelves, not explicit Wishlist filtering. Badges use the title metadata container outside links and controls, respecting showAITags.

The previous SDK Tabs component was visibly stuck on a Steam loading animation in the desktop Library Manager while the settings form below rendered normally. The update uses supported native DialogButtons as tabs with active states, keyboard navigation and preserved mounted forms, rather than mounting that unresolved component.

Automated coverage includes indexed-row ownership, mixed identity rejection, policy independence, unknown results, full-row hiding, metadata badges, preserved controls/track/indices, recycled IDs, new rows, native form events, named preset order, popup replacement and cleanup. The eight publicly checked example Wishlist titles had no official notes; no AI badge was invented for them.

Live 0.7.9 verification: Wishlist Options displayed the added preset group. Tomb Raider: Legacy of Atlantis showed its disclosure badge; Hide Disclosed hid its entire indexed row and Horizon Forbidden West moved into that position. Show All restored the Tomb Raider row and its badge; the Wishlist count remained 45. No Wishlist remove/purchase/reorder action was submitted. The native Settings and Information tabs rendered and switched with clear active states and no loading placeholder. Initial injected radio labels lost native vertical layout because of an extra wrapper; the final markup puts labels directly under the section and uses the surrounding native label text color for explanatory/status text. All other user policies were retained; Wishlist mode was restored to Show All after testing.

Final installed layout verification: the AI preset radios now use Steam's native vertical rows, with readable description/status text. Compact view remained functional; Hide Disclosed hid two resolved titles in the loaded compact rows, while Show All restored them. The original expanded view and Show All mode were restored after testing. Settings/Information and expanded-row hide/reflow/restoration were verified live earlier in the same pass. The installed v0.7.9 archive verifies successfully; 75 automated tests, TypeScript and formatting checks pass.

## Wishlist slider, metadata and active tags — 0.7.10

Inspected the native Price range/datalist and removable Platform tag in the current public Wishlist. Release/review metadata shares a horizontal uQ8Li0MwEhQ- flex row in expanded and compact entries. AI badges now append to that row rather than title links. Options uses a labeled range with native price classes, selectable preset names/ticks and a refresh action. Saved ordering and named presets remain shared; long preset collections scroll horizontally rather than widening the popup.

Steam keeps an empty direct Panel chip row mounted below its DFhzzTUhoEs- controls. The adapter requires that observed structure and an unambiguous row of native/plugin chips before adding its own Gen AI tag. Removing it resets only wishlistMode to Show All. Steam's chips, handlers, membership, ranks and native filter state are preserved. The Wishlist completion/hidden-count UI has been removed, including its controller callback.

All 76 regression tests, TypeScript, formatting and release packaging pass. New regression coverage exercises every built-in slider option, refreshed named presets, native-chip coexistence, chip removal, host replacement and cleanup. The installed 0.7.10 archive verifies successfully. Native visual verification is pending: Millennium closed Steam on reload and the computer-use launcher did not expose a targetable window; the user has been asked to reopen their Wishlist.

Post-install native verification completed after the user reopened Steam: the horizontal names/range/ticks and Refresh filters button rendered alongside the native Price control. Changing Show All/Light/Hide updated the Gen AI chip; removing that chip reset only AI filtering and retained SteamOS/Linux. Clearing/reapplying the native platform filter also retained the AI chip. Tomb Raider: Legacy of Atlantis displayed its badge beside the release date in both expanded and compact views; Hide Disclosed removed its full compact row and the following game reflowed. Multiple entries with/without review metadata retained their normal layout. No completion/hidden-count status appeared. Original Light Usage, SteamOS/Linux, expanded view and Discount sort were restored; Wishlist membership/ranks were unchanged. Named presets and refresh-added options were covered by regression tests rather than creating test filters in the user's settings.

## Fixed Wishlist slider and concise Information — 0.7.11

Removed the preset-name buttons, scroll viewport and Refresh filters action. The range now occupies 100% of its existing two-column Options group regardless of preset count. Its datalist adds stops and its max changes with the shared preset list. The selected name/description and active chip remain, with immediate filtering and automatic config updates. Regression coverage adds 30 custom filters (34 total stops), selects every custom mode and confirms unchanged range sizing, no extra buttons/scroll viewport, native form events, chips and popup remount behavior. TypeScript and all 76 tests pass.

Information uses 14px bold section labels and 13px body text rather than the larger DialogSubHeader/Field cards. Features/help, classifications and limitations remain concise. The native DialogButton at the bottom is disabled while BUG_REPORT_URL is empty; no placeholder navigation or GitHub upload occurs.

AI usage sorting remains unimplemented, explicitly documented rather than offering a partial sort. The inspected Wishlist route uses order/name/price/discount/dateadded/topsellers/releasedate/reviews; GetWishlistSortedFiltered supplies the ordered items before the dynamic virtualizer. Local DOM reordering would sort only mounted rows and break consistency on scroll. Native ranking also has a separate account-writing Reorder path, which must not be reused for this local feature. The current isolated webkit API exposes no Wishlist data-sort extension. The official Hooking documentation describes client router source transforms with frontend exports, but does not establish a supported Wishlist SSR data hook. A verified full-list integration is required before adding this option. No native sort enums, rank data or preferences were invented or overwritten.

## Compact controls and insertion preview — 0.7.12

Wishlist Options now uses a single normal filter column, aligned to the start rather than stretched by adjacent groups. Removed the always-visible multi-line preset paragraph; the explanation remains on the slider and selected label as a tooltip. Only heading, range/ticks and selected preset consume normal space, matching Price's structure. All custom stops, immediate filtering, active tags and error feedback remain.

Reviewed the installed SDK declaration and official Millennium source at src/typescript/sdk/src/sharedjscontext/custom-components/ReorderableList.tsx. That component uses gamepad DIR_UP/DIR_DOWN with a reorder mode and animated row scaling; it has no mouse/pointer drag insertion preview. Kept the existing native Focusable handles with pointer capture. Drop targets now specify a before/after boundary, and a two-pixel Steam-blue line appears in the gap at that exact position instead of boxing another card. Midpoint hit testing handles gaps and either end; locked/cross-list targets remain rejected. The save helper recomputes the target index after removing the source, so downward insertion matches the preview. Keyboard movement retains its previous semantics.

Restored compact classification cards around the shorter Information descriptions, retaining 14px bold section labels, 13px text and the unchanged disabled GitHub placeholder. TypeScript and all 77 tests pass, including explicit preview/save agreement upward/downward/in gaps, cancellation/locked/cross-list protection, compact Wishlist structure and 30 custom presets. Native post-install visual verification remains to be completed.

## Shared category mounting correction — 0.7.14

Live inspection on 29–30 October 2026 reproduced the missing category sidebar on Stable as well as Beta. The older sidebar/header hashes documented above no longer identify the current component. The input → sidebar → adjacent game-list relationship and native polygon-chevron filter groups remain recognizable. The shared adapter now discovers that structure without category URLs, English labels or new generated hashes, and obtains native header styling from the rendered groups. Existing hashes remain only as compatibility fallbacks.

The same host discovery scopes the listing policy, keeping neighboring discovery shelves independent. Tests cover delayed cards, empty-result boundaries, native rerenders, changed hashes/labels, and hide/restore through the slider. All 81 tests, TypeScript, formatting and Starlight archive verification pass. Live VR and Sniper controls were checked on Stable 1792618285 and Beta 1793235415; Beta VR Hide Disclosed removed F1 25 and Show All restored it without leaving an empty row. See [the category verification report](category-verification-0.7.14.md) for scope and limits.
