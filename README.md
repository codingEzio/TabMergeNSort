# Tab Merge N Sort

<p><img src="extension_chrome/icons/icon-128.png" width="96" height="96" alt="Tab Merge N Sort"></p>

[English](README.md) · [简体中文](README.zh-Hans.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md)

## Overview

Chrome and desktop macOS Safari source version 0.99.0. This extension merges
tabs and sorts the current window or all windows by URL or title.

Safari functional limitation: Apple's
[Web Extension compatibility guide](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility)
lists `tabs.move` as unsupported. Merge and sort depend on that API. When the
API is absent, the extension reports that this browser cannot move tabs and
leaves the tabs unchanged. Version 0.99.0 metadata does not establish Safari
functional parity. No tab close/reopen workaround or native automation
permission is added.

For Chrome, load this checkout's `extension_chrome/` directory with Chrome's
**Load unpacked** action. No workspace hub or symbolic link is required. The
existing public-key-pinned extension identity and storage keys are retained.

## Source and maintenance

Install Deno 2.x and Git, then run:

```sh
deno task check
deno task build
```

Checks use synthetic local fixtures. Build writes a verified Chrome candidate
under ignored `Local/candidates/`; it does not install or open a browser.
`extension_chrome/` owns the editable runtime. `shared/`, `vendor/` and the
entries in `dependencies.lock.json` are pinned generated inputs. Ordinary
checks/builds use those local inputs and do not read sibling checkouts.

To update a dependency, change its source owner first and explicitly sync the
reviewed input:

```sh
deno task deps:sync --owner=X-ExtShared --workspace=/absolute/path/to/source-workspace
deno task check
```

Keep the resulting hashes and generated files together. See
[dependencies](DEPENDENCIES.md) for tools and platform limits.

Desktop Safari has separate native source, generation checks and signing
requirements; Chrome packaging does not prove a Safari build or installation.
The generated macOS host configuration shares version 0.99.0 with its extension.
Deno checks need no sibling directories. Native scripts require macOS, Xcode,
XcodeGen at `/opt/homebrew/bin/xcodegen`, and a user-created
`Local/signing/safari_identity.conf` with `SIGNING_IDENTITY` and
`DEVELOPMENT_TEAM`. No signing identity is shipped. Mobile Safari/iOS and
Android VIA are outside this release work. Firefox delivery is not part of these
commands. Native identifiers must remain stable to preserve existing
installations. Signing keys and local configuration belong in ignored `Local/`
and are never public inputs.

## Local source review

`public-source.json` lists the exact source payload. Stage intended named files,
then run `deno task maintenance` and `deno task public:prepare`. The latter
exports the Git index to an immutable directory under `Local/public-source/` and
reads back all file hashes. Existing candidate directories are not overwritten;
`public:check` is read-only and repeatable.

The selection excludes internal plans, historical operation records and local
configuration. It rejects symlinks and limited sensitive-content patterns; this
is not universal secret detection. Receipts contain relative paths only. The
existing repository history is unchanged and is not in the candidate.

Project-owned code in release 0.99.0 is licensed under
[GNU GPL version 3 only](LICENSE) (`GPL-3.0-only`), copyright 2026
X-ExtTabMergeNSort contributors. See [NOTICE.md](NOTICE.md) for the scope,
retained prior MIT grants, and separate third-party/font terms. Native installation
and upgrades have not been verified.

This candidate generalizes shared design review notes and updates its local lock;
source assets and license notices remain unchanged.
