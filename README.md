# AI Disclosure Filter for Millennium

A SteamBrew Millennium/Starlight plugin that filters compatible Steam storefront games using Steam's official generative AI disclosures. No visual AI detection, external server, API key or telemetry. Unknown results stay visible; no disclosure found does not mean AI-free.

**Publishing status:** local development build, not approved for the SteamBrew directory. Read the [release review](docs/release-review.md) for eligibility questions, licensing and verification still required. This project was developed extensively with generative AI assistance; that history must be disclosed honestly when discussing submission.

## Local development

Install Millennium and a current Node.js LTS release, then run:

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd test
npm.cmd run package
node_modules/.bin/starlight.cmd verify ai-disclosure-filter.star
```

`npm ci` generates local SDK/backend types through Starlight's prepare step. `package` creates an unsigned local archive without installing/uploading it. `npm.cmd run build` uses the manifest's `output_path = "auto"` to install into Millennium and may restart Steam UI. `npm.cmd run dev` watches changes. Reopen store views after installing an update.

`npm.cmd run format` formats source/tests; `npm.cmd run format:check` checks formatting. Dependencies are pinned. Tests use offline fixtures rather than live Steam requests.

## Controls

Compatible search/category/tag/sale sidebars receive a **Generative AI** slider. Loaded and dynamically inserted cards are processed automatically.

- **Show All** displays every game while checking disclosures.
- **Light Usage** allows translation/localization, concept work and narrowly scoped development assistance; other disclosed uses are blocked.
- **Custom** matches saved case-insensitive disclosure phrases.
- **Hide Disclosed** blocks every officially disclosed game, regardless of classification.
- **Named custom filters** match chosen usage types and/or phrases. Presets share a configurable order; Show All stays first.

**Review disclosures & exceptions** lists blocked titles from the current listing. Its search covers those titles. Persistent exception chips below can be removed locally. **Refresh filters**, beside the slider, reloads saved definitions without clearing caches or reloading Steam. Search totals remain Steam's totals; a separate line reports hidden loaded cards.

Open **Steam → Millennium Library Manager → AI Disclosure Filter** for default listing and separate discovery presets; shared Custom phrases; visibility controls for AI labels/game-page disclosures; wishlist/owned discovery exemptions; persistent exceptions by App ID; named filter editing/ordering; and FAQ. Wishlist protection starts enabled; ownership protection starts disabled. Explicit exceptions override all presets. Reorder by dragging or focusing a handle and pressing Alt+Up/Down.

**Either rule can block** matches a blocked usage type OR a phrase. **Both rules must match** requires both; if one group is empty, the other applies. Allow is not an exemption: another matching rule can still block the game. Phrases match literally, including negated wording. Limits: 500 exceptions, 30 named filters, 30 phrases per filter. Deleting a selected named filter returns its selectors to Show All.

## Discovery and indicators

Discovery filtering is independent of listing filtering and defaults to Show All. Supported shared components include featured previews, discount capsules, calendar/recommendation cards, expanded category cards, indexed panels and chart rows. Steam's wishlist/ownership markers determine discovery exemptions; missing/delayed markers cannot be inferred.

Confirmed disclosures receive compact metadata badges where a safe host exists, including supported hover popups. Artwork and wishlist controls are kept clear. App pages receive a collapsible disclosure in their top information card. Opening an app page never hides it.

Normal grids reflow through reversible presentation attributes. Indexed carousels retain Steam's indices/nodes: existing navigation skips fully blocked pages where supported; fixed slots receive a **Hidden by AI filter** explanation where removal would break geometry. Turning filtering off/stopping restores presentation. Back/Forward restoration restarts the session without a refresh.

## Classifications

These are deterministic English text interpretations, **not Valve categories, quality ratings or proof of undisclosed AI usage**.

| Label            | Interpretation                                                                      |
| ---------------- | ----------------------------------------------------------------------------------- |
| AI - Light       | Translation/localization, concept/reference work or limited development assistance. |
| AI - Audio       | Generated voices, narration, music or audio.                                        |
| AI - Content     | Generated or AI-assisted artwork, writing or in-game assets.                        |
| AI - Interactive | Player-driven illustrations, live generation or AI conversations.                   |
| AI - Heavy       | Explicit extensive generation across several content domains or an entire product.  |
| AI - Unclear     | Wording insufficient for a supported interpretation.                                |

Rules consider affirmative claims, negation, references and breadth. Multiple facets can match custom filters; badges show a primary classification. The established development-assistance wording used by ARC Raiders/THE FINALS qualifies as Light under the current policy, including its narrow commentary example. Hide Disclosed still blocks it. There is no game-name or App ID blocklist.

## Data, privacy and performance

The primary source is Steam's public `IStoreBrowseService/GetItems/v1/`, requesting extra details/reviews. Only successful, visible, identity-matched app responses are trusted. Nonempty `extra_details.content_survey_ai_notes` means disclosed. Missing notes in validated details mean no disclosure found; incomplete results stay unknown. English HTML is a conservative fallback requiring the exact official heading and correct App ID. See [research evidence](docs/research.md).

Requests omit credentials, use English/US context, coalesce up to 40 IDs per batch and permit two batches at once. HTML fallback permits four concurrent requests. Timeouts are ten seconds; 403/429/5xx cause a five-minute cooldown without bypassing throttling through HTML. These are local safeguards, not Valve quotas. Each view caches up to 1,000 results: positive 24 hours, negative six hours, unknown 30 seconds. Cleanup cancels active requests and prevents queued work from starting.

Preferences, custom filters, exceptions and up to 300 disclosed-title records are saved locally in Millennium configuration. History contains App IDs, titles, disclosure text, review counts and prior hidden state for exemption context. No account credentials are read; no data is sent to third-party services. Steam receives requested public App IDs. Disabling restores presentation through a best-effort backend lease, normally within about seven seconds.

## Code map

| Location                                                           | Responsibility                                                                |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `millennium.toml`                                                  | Starlight manifest and three entry points.                                    |
| `backend/main.lua`                                                 | Defaults, validated bounded history merge and local policy via generated FFI. |
| `frontend/index.tsx`                                               | Native Millennium tabs and registration.                                      |
| `frontend/settings.tsx`, `editor.tsx`, `information.tsx`, `ui.tsx` | Settings, editor, FAQ and shared section layout.                              |
| `frontend/ordering.ts`                                             | Pointer/keyboard ordering.                                                    |
| `shared/`                                                          | Normalization, policy matching, classification and history.                   |
| `webview/preload.ts`, `lifecycle.ts`, `config.ts`                  | Sessions, subscriptions, cached navigation and missed-broadcast recovery.     |
| `webview/steam/`                                                   | Observed Steam components, App IDs and providers.                             |
| `webview/cache/`                                                   | Batching, deduplication, expiration and cleanup.                              |
| `webview/filtering/`                                               | Policy application, dynamic updates and restoration.                          |
| `webview/ui/`                                                      | Sidebar, badges, app-page panel and layout adapters.                          |
| `tests/`                                                           | Offline fixtures and regression coverage.                                     |

Configuration APIs are compiler-bound; do not manually insert the plugin ID. Generated FFI provides backend methods. MutationObserver handles rerenders; deprecated Millennium DOM polling hooks are not used. Native React components belong to SharedJSContext; storefront preloads operate in separate documents. Narrow custom DOM adapters are explained in the release review.

## Verification and limitations

Tests cover disclosure identity/parsing, concurrency/cooldowns/cancellation, policies/classification/exemptions, dynamic/recycled cards, sidebar interactions, layout restoration, hover identity and cached navigation. Package verification checks compilation/integrity, not native appearance or directory approval.

Steam hashes/layouts can change. Some virtualized or unique Discovery queues/pages cannot reliably remove every title. Unknown components stay untouched; unloaded results are not fetched. Demo IDs are not mapped to parent games. English rules can misinterpret mixed wording. Other regions, Steam Stable/Beta, keyboard/controller navigation and unusual carousel experiments need manual coverage. Historical live checks are recorded in [research](docs/research.md); this cleanup does not claim a fresh exhaustive Steam UI test.
