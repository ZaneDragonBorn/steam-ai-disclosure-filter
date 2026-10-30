# Pre-publication review

> Historical review. See the [follow-up](submission-follow-up-2026-10-29.md) for the MIT license, verified UI component decisions, confirmed maintainer identity and updated eligibility assessment.

Reviewed 2026-10-25. This is a technical audit, not SteamBrew approval. Nothing was uploaded, submitted or published.

## Eligibility: unresolved

The official [submission guidelines](https://docs.steambrew.app/developers/submitting-plugins) restrict primarily AI-generated plugins and require honest disclosure of AI assistance. This project has extensive AI-generated implementation history. Refactoring does not change its origin. The maintainer must assess eligibility with SteamBrew; do not assert compliance or conceal that history.

The same guidelines require functionality specific to the Steam client; settings alone are insufficient. This plugin uses Millennium configuration/FFI, but its central behavior modifies storefront pages. Whether that qualifies needs SteamBrew's decision.

## References

- [Submission guidelines](https://docs.steambrew.app/developers/submitting-plugins): eligibility, native UI, theme boundaries.
- [Plugin database](https://github.com/SteamClientHomebrew/PluginDatabase): eventual submissions pin a source submodule for review; upstream changes alone do not publish updates.
- [Submission checklist](https://github.com/SteamClientHomebrew/PluginDatabase/blob/main/.github/pull_request_template.md): authorship, licenses, open source, distinct functionality, Stable/Beta and independent tests. Some backend wording is legacy; use the current Starlight docs/template for architecture.
- [Official template](https://github.com/SteamClientHomebrew/PluginTemplate), [manifest](https://docs.steambrew.app/plugins/structure/config), [configuration](https://docs.steambrew.app/plugins/advanced/config), [hooking](https://docs.steambrew.app/plugins/advanced/hooking).

## Audit and changes

| Area                 | Finding / correction                                                                                                                                                                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture         | Modern manifest, TSX frontend, webkit preload and Lua backend. Pinned Starlight 1.1.3 matches the template baseline. No legacy Python backend or deprecated Millennium DOM/window/RPC APIs.                                                                                                                 |
| Configuration        | Supported compiler-bound config APIs and generated FFI retained. Existing keys/defaults/exemptions preserved. Deleting a selected named filter clears discovery selection too.                                                                                                                              |
| Native UI            | Replaced custom navigation with exported Tabs; native Field, inputs, actions, dialog text/headings and Focusable reorder handles. Form stays mounted to preserve drafts across tab changes.                                                                                                                 |
| Custom UI exceptions | No accordion or pointer reorder component is exported by the installed SDK. Accessible browser disclosures wrap native headings; ordering keeps a keyboard alternative. Badges and fixed-slot explanations have no direct equivalent.                                                                       |
| Storefront adapters  | Store preloads run separately from SharedJSContext's React library. Inspected search/sale markup uses scoped DOM adapters, Steam classes and native jQuery collapse behavior. Reviewers must decide whether these UI exceptions satisfy policy. No second React runtime or speculative private hooks added. |
| Hooking              | Reviewed the supported served-script Hooking API. Current functionality needs no SharedJSContext script patch. No deprecated polling hook or unverified regex patch introduced.                                                                                                                             |
| Network/security     | Fixed Steam origins, numeric App IDs, omitted credentials, identity/content checks, bounded batches/timeouts/cooldowns. No external server, telemetry, cookie reads, remote JS/CSS or user-supplied request URLs.                                                                                           |
| Cleanup              | Terminal provider/cache cancellation prevents queued fallback requests after stop; queued cache callers settle unknown and late results are discarded. Cached-page session restoration retained.                                                                                                            |
| Dead code            | Removed old standalone Next Fest detector, unused filterAlive, plugin-ID constant, normalized reveal field, request-budget machinery and duplicate ignore entries. Retained small stored-key migration.                                                                                                     |
| Readability          | Split settings into editor/settings/information/layout modules. Shared reviewed-title type no longer depends on the controller. Reuse descriptions and preset lists. Consistent formatter/check added as a pinned dev dependency.                                                                           |
| Validation           | Saved and incoming Lua history are validated/bounded. Frontend rejects out-of-range IDs; review numbers are clamped. Negative structured results clear old metadata.                                                                                                                                        |
| Dependencies         | Development tooling only; no production dependency added. Installation audit reported no known vulnerabilities at review time.                                                                                                                                                                              |

All production modules, build scripts/configuration, dependencies and regression fixtures were reviewed. Observed layout adapters were retained instead of replacing working behavior with unverified Steam internals. Historical investigation is not exhaustive current live coverage.

Verification for v0.7.8: 71 tests pass, strict TypeScript checks pass, and the unsigned local package compiles and verifies. Formatting checks cover maintained source/tests; SDK-managed JSON is excluded because Starlight rewrites it during builds. No local Steam installation was replaced during this cleanup. The workspace had no existing commits, so the requested commit establishes an initial source baseline. Local research scratch files, generated packages, promotional work and Codex configuration are excluded.

## Maintainer checks before release

**0.7.9 correction:** native client testing found that the exported Tabs component stayed on a Steam loading placeholder in desktop Library Manager. It was replaced with the already-supported native DialogButton controls, retaining tab semantics/selected styling and mounted drafts. The 0.7.8 table above records the earlier audit, not a guarantee that every exported component resolves in every host. Wishlist integration uses the inspected native Options form schema and metadata layout; see the research log for virtualization constraints.

- Resolve both eligibility issues and disclose AI involvement accurately. Be able to explain and maintain the implementation.
- Choose an open-source license and add its full text. No license was selected automatically. Verify notices for SDK/compiler-generated runtime material and any upstream-derived code before distribution.
- Test this exact build on Steam Stable and Beta, including supported platforms. Linux/channel certification is not claimed.
- Inspect native Tabs, headings, collapse, retained editor drafts, narrow layout and keyboard/controller focus in Library Manager. Compilation confirms exports, not appearance.
- Recheck filtering, dynamic cards, both policies, exemptions, Back/Forward, carousel restoration, disable/re-enable and network failure. Include signed-in wishlist/ownership and regional wording.
- Confirm local bounded disclosure history and discovery limitations are sufficiently disclosed; README describes both.
- Verify a clean checkout installs/generates types/packages on another machine. Package integrity does not replace independent review.
- Only after separate authorization, compare directory alternatives, prepare a submission and arrange third-party tests. This pass creates no remote, repository upload or PR.

## Code walkthrough route

Start with policy matching in shared/settings.ts, then text classification. Follow a card from surfaces through provider/cache and controller. Review reversible layout adapters separately. Finish with native config controls, Lua history and page lifecycle. Change a small fixture, predict the result, then run it to learn each boundary.
