# v0.7.14 category adapter follow-up — 30 October 2026

## Root cause and implementation

The missing VR sidebar was reproduced on Stable build **1792618285**, not just
Beta. Live `/vr` inspection found zero matches for the previous hashed sidebar
class. Steam now renders different generated classes for the same filter browser.

The shared adapter now identifies a native `DialogInput`, repeated native filter
groups with Steam's polygon chevron, and their adjacent application-card list.
It does not select a category by URL, require English filter labels, or branch on
the Steam client channel. The original adapter remains as a compatibility fallback.

Both sidebar mounting and card policy selection use this adapter. Cards within
the associated list use the normal listing preset; nearby discovery shelves keep
their independent policy. Native header/title classes are obtained from the
rendered group, rather than from another hardcoded set of current hashes.

Bounded ancestor traversal and the direct group-container boundary prevent an
empty list from absorbing an unrelated discovery shelf. A mounted sidebar stays
usable during temporary empty results. Existing mutation observers handle delayed
cards and replaced sidebars. No disclosure, exemption, cache or classification
rules were changed.

## Automated verification

- **81 tests passed**, no skipped tests; TypeScript and full project formatting passed.
- A reduced fixture from the observed Stable VR DOM is included in
  `tests/fixtures/category-browser.html`.
- New checks cover renamed generated classes and translated labels across VR,
  Sniper, category and sale paths; listing/discovery policy isolation; slider
  hide/restore; delayed cards; temporary empty results; sidebar replacement;
  mount deduplication; and rejection of unrelated navigation controls.
- Production package and installed archive SHA256 both:
  `D3D03CB1218934A48854F03E9CF44E5233FB4010E51FE3EC20713F3F59D98416`.
- Starlight verified all five archive sections, including the license/notice assets.
  The development archive is unsigned.
- Temporary local inspection entry was removed from the production build.
  Its `_listingDiagnostic` configuration key was confirmed removed after loading.

## Live checks

- Stable **1792618285**: VR and Sniper both display the Generative AI controls
  beside the native filter groups. Sniper mounted after its delayed results loaded.
- Stable VR: searching the native listing for `F1` with Light Usage produced
  **1 card hidden**, while the independent discovery shelf remained visible with
  Discovery set to Show All.

- Beta **1793235415**, confirmed from the running UI after the actual channel
  update/restart: VR displays the same controls. With the native name search set
  to `F1`, Light Usage and Hide Disclosed each hid the disclosed F1 25 result.
  Show All restored the F1 25 listing and changed the count back to zero.
  Remaining rows closed the removed result's space. The separate discovery F1
  capsule remained visible under Discovery Show All.

- Beta Sniper: the Generative AI group appeared alongside the normal native
  filter groups with the default Light Usage selected. No per-category selector
  or channel-specific code was needed.

Steam was returned to Stable, confirmed from running build **1792618285**.
The default Light Usage preset, Discovery/Wishlist Show All, two exemptions,
visual switches and owned/wishlist discovery protections were preserved.
No custom filter or exemption was created or removed during these checks.

## Practical limits

This supports the observed shared filter component, not every arbitrary Steam
layout. A future change to its semantic input/card classes or chevron hierarchy
may require updating this isolated adapter. New, completely empty browsers do
not mount until an associated application card establishes the list boundary.
Other publication review requirements remain separate from this compatibility fix.
