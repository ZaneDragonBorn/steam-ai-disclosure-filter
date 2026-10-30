# Third-party notices

The plugin's original code is maintained by **Zane Dragonborn** and licensed under
the MIT license in [LICENSE](LICENSE). This does not replace upstream licenses,
Valve's rights in Steam, or developers' rights in their disclosure text.

## Millennium and Starlight

The project builds with `@steambrew/starlight` 1.1.3 and binds to Millennium's
runtime APIs. The compiler emits a small JavaScript shim; the application does
not bundle a second React runtime or copies of the native component library.
The native Steam components are resolved from the user's existing client.

The [Millennium repository license](https://github.com/SteamClientHomebrew/Millennium/blob/main/LICENSE.md)
is MIT. Its notice is retained here for compiler-generated material covered by
that license:

```text
MIT License

Copyright (c) 2026 Project Millennium

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The [Millennium SDK](https://github.com/SteamClientHomebrew/Millennium/tree/main/src/typescript/sdk)
has its own **LGPL-2.1-only** package declaration and
[license](https://github.com/SteamClientHomebrew/Millennium/blob/main/src/typescript/sdk/LICENSE).
It remains separately licensed; the project's MIT license does not relicense it.
The compiler binds `millennium` and React imports to the installed host. Generated
SDK declarations and SDK source are not distributed in this source repository.
If future changes copy or redistribute SDK implementation code, review its LGPL
obligations before distributing those changes.

Starlight's npm package omits a license field. That omission is documented here
rather than treated as a prohibition on compiler output. The compiler executable
and its dependencies are development tooling and are not shipped inside the plugin.

## Build dependencies

These run when building or checking the source; their implementation is not bundled into
the plugin. The lockfile records exact versions and license identifiers:

| Direct package   | Version | License    |
| ---------------- | ------- | ---------- |
| TypeScript       | 5.9.3   | Apache-2.0 |
| Prettier         | 3.6.2   | MIT        |
| @types/react     | 19.1.1  | MIT        |
| @types/react-dom | 19.1.1  | MIT        |

Dependency license declarations are recorded in `package-lock.json`. Preserve
their supplied license files if redistributing a dependency tree or build-tool
bundle. This repository excludes `node_modules`, generated SDKs and compiled
plugin archives.

## Steam content

Steam and its assets belong to their respective owners. Storefront artwork is
not packaged by this plugin. Steam disclosure text is retrieved at runtime;
this project does not claim ownership of or relicense that text.
