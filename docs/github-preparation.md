# GitHub preparation — 30 October 2026

Selected repository: **ZaneDragonBorn/steam-ai-disclosure-filter**.
This is the historical preparation record from before the repository was created.
The project now has a [GitHub repository](https://github.com/ZaneDragonBorn/steam-ai-disclosure-filter).

## Completed locally

- Reviewed prospective public text files and the single reachable Git commit for
  common credential patterns, personal paths/account data and accidental artifacts.
  No private data was identified in the material reviewed. A path-pattern match
  was the keyboard sequence `Left/Right/Home/End`, not a filesystem path.
- No screenshots, videos, logs, dumps or package archives are currently in the
  prospective public file set. Research captures, configuration backups, generated
  SDK files, dependencies and local packages remain ignored.
- Added ignore rules for environment secrets, dumps and backup files.
- Existing commit author is the Codex tooling identity. History was not rewritten.
  The plugin author and MIT notice remain Zane Dragonborn.
- Moved technical README sections into [development.md](development.md). The root
  README remains the actual GitHub README for the maintainer to edit.
- Added screenshot areas to the README and filename/insertion guidance in
  [images/README.md](images/README.md). Review any future screenshots before upload.
- Added `.github/workflows/checks.yml`: read-only Windows CI for dependency
  installation, TypeScript, tests, formatting, packaging and archive verification.
- Added `.gitattributes` to keep source LF line endings across Windows checkouts.
  The first clean-clone check exposed CRLF formatting failures; the correction
  passed in a second clean clone.

## Verification

A temporary local repository snapshot of the current candidate was cloned without
existing dependencies or generated SDK files. The main repository's history/index
was not changed. In the clean clone:

- `npm ci` succeeded and reported no known dependency vulnerabilities.
- TypeScript passed; all **81 tests passed**, none skipped.
- Formatting passed.
- Packaging succeeded and Starlight verified all five sections, including notices.
- Git working status stayed clean after the checks.

GitHub Actions itself has not run because there is no remote repository yet.
This review is not a guarantee that every possible secret pattern is detected,
nor approval from the Millennium Plugin Database. No Steam installation was
changed during this preparation.

## Remaining owner steps

1. Edit the root README and add the screenshots intended for public display.
2. Create an empty public repository named `steam-ai-disclosure-filter` under
   `ZaneDragonBorn`. Do not initialize another README, license or gitignore.
3. Provide its URL. If a Git authentication prompt appears during the first push,
   complete that sign-in yourself.

The GitHub connector is already connected. Git Credential Manager is installed;
GitHub CLI is not installed and is not required for the proposed workflow.

After the repository exists, the remaining technical work is remote setup,
final-file review/commit/push, enabling the plugin's issue-tracker link, checking
the hosted CI run, and preparing a release and separate Plugin Database PR.
Keep the current bug-report button disabled until its destination exists.
