# Coach Intel Versioning

The root `package.json` is authoritative for Electron releases. `web/package.json`
must match it; run `npm run verify:version` before building a release. Current
version: **3.9.0**.

Use the following release increments:

- Major: `+1`
- Minor: `+0.1`
- Mini: `+0.0.1`

For example, the first major increment after `1.5.0` is `2.0.0`; a minor
increment is `1.6.0`; and a mini increment is `1.5.1`.

For a macOS release, the tagged version creates immutable artifacts named:

- `Coach-Intel-{version}-macOS.dmg`
- `Coach-Intel-{version}-macOS.zip`
