# Development and technical reference

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

## Data, privacy and performance

The primary source is Steam's public `IStoreBrowseService/GetItems/v1/`, requesting extra details/reviews. Only successful, visible, identity-matched app responses are trusted. Nonempty `extra_details.content_survey_ai_notes` means disclosed. Missing notes in validated details mean no disclosure found; incomplete results stay unknown. English HTML is a conservative fallback requiring the exact official heading and correct App ID. See [research evidence](research.md).

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

Steam hashes/layouts can change. Some virtualized or unique Discovery queues/pages cannot reliably remove every title. Unknown components stay untouched; unloaded results are not fetched. Demo IDs are not mapped to parent games. English rules can misinterpret mixed wording. Other regions, Steam Stable/Beta, keyboard/controller navigation and unusual carousel experiments need manual coverage. Historical live checks are recorded in [research](research.md); this cleanup does not claim a fresh exhaustive Steam UI test.

The Information tab links to the project's GitHub issue tracker. AI usage sorting is not implemented: Steam sorts Wishlist data before virtualizing its rows, and the current adapter has no verified full-list sorting hook. Native sort/rank behavior is preserved.
