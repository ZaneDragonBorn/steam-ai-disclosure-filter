# Submission follow-up — 29 October 2026

Author and maintainer: **Zane Dragonborn**. Version: **0.7.13**.

This supersedes the current-readiness assessment in the earlier review. It
records the maintainer's clarification, the MIT choice and completed corrections.
No source has been uploaded and no Plugin Database PR has been created.

## Outcome

The actionable licensing, author metadata, formatting, native-component and
package-notice issues are corrected. No reviewed dependency needs replacing to
release this plugin under MIT. Remaining work is release verification and a
maintainer decision on the published eligibility rules, rather than an identified
dependency prohibition or a missing native-control investigation.

## Completed changes

| Item                 | Resolution                                                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| License              | Added the MIT license selected by Zane Dragonborn and declared it in package metadata.                                                                                                                          |
| Upstream notices     | Added `THIRD_PARTY_NOTICES.md`, including the Millennium MIT notice and separate SDK LGPL identification. Both it and `LICENSE` are bundled using the documented `[assets].resources` option.                   |
| Author               | Manifest, README, license and current review documents identify **Zane Dragonborn** consistently. The existing `dev.zanedb.ai-disclosure-filter` identifier is preserved.                                       |
| Native UI            | Replaced Information classification cards' custom div presentation with native `Field` rows and `DialogBodyText`. See the [component audit](ui-component-audit.md) for other controls and justified exceptions. |
| Formatting           | Fixed Information source formatting while preserving the maintainer's edited text and disabled GitHub button.                                                                                                   |
| Review documentation | Corrected the database checklist link, marked older reports historical and separated technical findings from policy decisions.                                                                                  |
| Release artifact     | Built and verified workspace-only v0.7.13, including the two license assets. The package command does not reinstall the plugin or restart Steam.                                                                |

## Dependency and licensing findings

The original plugin is now MIT: others may use, modify, distribute and sell
copies while preserving its notice. Your own release can remain free. MIT does
not relicense Steam, third-party SDK code or game developers' disclosure text.

There are no npm runtime dependencies. The compiler resolves the client React
and Millennium imports against the installed host rather than bundling another
React/component library. TypeScript, Prettier, tsx, jsdom and their type packages
are build/test tools; their reviewed declarations are MIT or Apache-2.0. The
transitive lockfile declarations are permissive; exact direct versions and notice
handling are recorded in [third-party notices](../THIRD_PARTY_NOTICES.md).

The upstream [repository license](https://github.com/SteamClientHomebrew/Millennium/blob/main/LICENSE.md)
is MIT, while the [SDK package](https://github.com/SteamClientHomebrew/Millennium/blob/main/src/typescript/sdk/package.json)
separately declares LGPL-2.1-only. Starlight's npm package lacks a license field;
that omission is not evidence that compiler output is forbidden. Its generated
shim's upstream MIT notice is retained in the packaged notices. Generated SDK
source/declarations, compiler executables and dependency trees are excluded from
the distributed source. Copying SDK implementation into future plugin code would
require reviewing that separate license again. Rewriting the host SDK would add
risk without resolving an identified distribution problem.

## What the storefront eligibility concern actually means

“Storefront documents” meant rendered Steam store pages, such as search results
and the wishlist; it did not mean documentation files.

The [published guidelines](https://docs.steambrew.app/developers/submitting-plugins#guidelines)
ask for Steam-client-specific functionality and caution that simple store-page
changes may belong in a browser extension. This plugin is broader: it resolves
official disclosures, applies persistent policies and exemptions across multiple
client store surfaces, and exposes configuration in Millennium. However, those
features mainly change store browser views. Local settings or a Lua backend alone
do not establish a capability that only the Steam client can provide.

That is the precise policy question for reviewers, not a claim that the plugin
is technically incompatible with Millennium. The earlier report overstated the
certainty of rejection. It should be presented to reviewers with its actual scope
and the maintainer's discussions, rather than adding unrelated client-only
features or asserting automatic approval.

## AI assistance and maintenance

Zane Dragonborn confirms having reviewed the code, understanding it and being
able to maintain and fix it. That attestation is accepted and recorded; code
inspection cannot replace the maintainer's own statement. The README retains an
honest description of extensive AI assistance.

The maintainer reports verbal guidance emphasizing maintainability and
Steam-native UI. That is relevant context, but it is not a public change to the
written rule concerning primarily AI-generated plugins. Answer the database's
factual checklist honestly and let its maintainers reconcile that guidance with
the published policy. This is a human submission decision, not something a
license change or cosmetic rewrite can certify.

## UI compliance findings

Official [file-structure documentation](https://docs.steambrew.app/plugins/structure/file-structure)
explicitly distinguishes a React-capable client frontend from a webkit preload
without React. Native client components are used for settings where available.
Storefront sliders, badges and forms use DOM adapters in that separate context;
installing a second React runtime to imitate client components would be a poor
substitute for the documented architecture.

The [component audit](ui-component-audit.md) records the actual alternatives
checked, including `Field`, tabs, collapse and reordering. The remaining custom
elements have specific technical reasons. Formal visual acceptance and
Steam-version compatibility still need normal live review, not an assumption
that compile-time checks prove appearance.

## Verification and remaining release steps

- TypeScript checking passed; all **77 regression tests** passed.
- Formatting passed; Starlight release packaging and section verification passed.
- A separate 60-file source-only copy also built and verified successfully without
  generated SDK files or a local dependency tree; it used the installed compiler
  from outside the copied source. This was a Windows clean-source build.
- The package reports the correct ID, version and author, and contains both
  license resources. It is unsigned, as expected for a local artifact before the
  database's signing process.
- The earlier same-day dependency audit found no known vulnerabilities. This is
  a point-in-time result, not a guarantee.

Before submission, test the exact release on Steam Stable and Beta, including
Settings/Information, search, categories/events, homepage/discovery, store-page
Back navigation and wishlist. Check disabling/re-enabling, restoration, errors
and exemptions. Do not mark unperformed platform or third-party tests complete.
The new native classification layout has not been freshly inspected in live Steam
in this pass.

Keep the source and notices together, commit the complete intended release only
after reviewing the working tree, and validate the database's Linux/Node 20 build
path. Local Windows packaging is useful evidence, not that CI run. The current
database uses a source submodule pinned to a commit; do not submit an archive-only
repository. The later PR should answer the current
[submission template](https://github.com/SteamClientHomebrew/PluginDatabase/blob/main/.github/pull_request_template.md)
truthfully. Testing two other plugin PRs is encouraged, not represented here as a
mandatory prerequisite or completed activity.

GitHub publishing, a submission PR and an installation into the user's current
Steam session remain outside this follow-up. The disabled bug-report destination
is intentional until Zane Dragonborn supplies a public repository URL.
