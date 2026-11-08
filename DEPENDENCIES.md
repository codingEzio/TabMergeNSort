# Dependencies

- Deno 2.x and Git run source checks and packaging on macOS.
  Test imports are pinned in `deno.lock`; a first cache fill may use the
  network. No Node/npm executable is required.
- `dependencies.lock.json` records generated input owners, source paths and
  SHA-256 hashes. Normal builds only use these local pinned copies. Explicit
  `deps:sync` accepts `--owner` and `--workspace`; omitted workspace uses the
  parent directory for this update command only. Missing inputs or differing
  checked hashes fail instead of downloading or replacing assets silently.
- Runtime fonts, icons, provenance and notices are bundled locally. removed font experiment is
  not a runtime dependency; the package verifier rejects its filenames and
  runtime references. Preserve the complete existing font/component notices.
- Safari source requires Xcode/XcodeGen and local signing/native-host setup.
  These are separate from portable Chrome checks. Credentials and signing
  configuration are private local inputs; source candidates do not provide them
  or claim a clean native installation.

Project-owned code in release 0.99.0 uses [GNU GPL version 3 only](LICENSE)
(`GPL-3.0-only`). [NOTICE.md](NOTICE.md) records the scope and retained
historical MIT grants. Bundled fonts and third-party assets keep their existing
terms, notices and authorship. No font files are removed or rebuilt. The
complete existing font pack is retained. The explicit source selection retains the complete font pack and its notices.
