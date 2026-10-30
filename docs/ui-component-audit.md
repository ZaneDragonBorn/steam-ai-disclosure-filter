# Millennium UI component audit

Maintainer: **Zane Dragonborn**. Reviewed 29 October 2026 against the current
official documentation, SDK declarations and upstream component source.

## Verified execution environments

The [official file-structure documentation](https://docs.steambrew.app/plugins/structure/file-structure)
separates two environments:

- **frontend:** Steam client UI with Steam's React instance and native components.
- **webkit:** browser views, including the store; React is unavailable to the plugin there.

The compiler maps frontend `millennium`, `react`, `react-dom` and JSX imports to
the host's existing objects. Its webkit defaults provide `millennium` APIs, not
the frontend's React runtime. Adding a second React copy or passing native
frontend components across browser documents is not the documented solution.
Therefore DOM adapters in a storefront preload are a technical requirement of
that execution environment, not evidence that an available native control was
ignored. The plugin copies the surrounding store's classes/structure where
observed and scopes its additional CSS.

## Component decisions

| Area                                     | Implementation / decision                                                                                                                                                                                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Settings selectors, inputs and actions   | Native `Dropdown`, `TextField`, `DialogCheckbox`, `DialogButton`, `Field` and `Focusable` imports from `millennium`.                                                                                                                                                                                   |
| Information classification cards         | Replaced individually styled div cards with native `Field` rows, compact padding and standard separators. Native `DialogBodyText` preserves the small typography.                                                                                                                                      |
| Settings/Information navigation          | Native `DialogButton` with tab semantics and keyboard navigation. The exported `Tabs` previously remained a loading placeholder in this desktop host; the working native buttons are retained.                                                                                                         |
| Collapsible settings and disclosure text | Browser `details/summary` around native headings/text. The inspected installed SDK has no exported accordion/collapsible section. This preserves accessible collapse without introducing a new dependency.                                                                                             |
| Custom filter order                      | Native `Focusable` handles with pointer capture and an explicit insertion line. The exported `ReorderableList` was reviewed: its implementation handles gamepad direction buttons with a reorder mode, not pointer dragging or insertion previews. Retain the existing pointer and Alt+Arrow behavior. |
| Search/category filter controls          | Storefront DOM range/buttons/inputs/disclosures. These execute in webkit and cannot mount the frontend's native React controls. Reuse observed Steam sidebar classes and native collapse helpers where available.                                                                                      |
| Wishlist Options                         | Native store form/range classes, datalist stops and selected label. No frontend component is exported for injection into this separate form. Events remain isolated from Steam's native filters.                                                                                                       |
| Game-page disclosure / card badges       | Small metadata additions in observed store containers. Native client settings controls are not substitutes for these storefront metadata elements.                                                                                                                                                     |
| Layout wrappers                          | Plain structural wrappers remain where they provide DOM grouping, ARIA relationships or reversible layout. They do not replace an available native interactive control.                                                                                                                                |

The SDK's `PanelSection`/`PanelSectionRow` were also inspected. They are native
section/layout components, not a replacement for collapse behavior or pointer
dragging. For the classification rows, the already-used `Field` is the direct
match and avoids adding an untested component resolver.

## Sources

- [Submission UI rule](https://docs.steambrew.app/developers/submitting-plugins#guidelines).
- [Native Field documentation](https://docs.steambrew.app/plugins/ts/components/Field).
- [Field implementation](https://github.com/SteamClientHomebrew/Millennium/blob/main/src/typescript/sdk/src/sharedjscontext/components/Field.ts).
- [Panel implementation](https://github.com/SteamClientHomebrew/Millennium/blob/main/src/typescript/sdk/src/sharedjscontext/components/Panel.ts).
- [ReorderableList implementation](https://github.com/SteamClientHomebrew/Millennium/blob/main/src/typescript/sdk/src/sharedjscontext/custom-components/ReorderableList.tsx).

This establishes the documented technical basis and replaces the available
native equivalent in Information. It does not claim that the database reviewers
have approved the UI or that every current Steam experiment has been tested.
