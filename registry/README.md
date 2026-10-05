# registry/

`index.json` is **generated** by `rdev plugin index` from the plugins under
`../plugins/`. Never edit it by hand. The builder lives in the `rdev`
toolchain and serializes the shared contract types, so the generator and the
app-side marketplace decoder share one definition of the catalog
(`plugin-registry-index-v1`; see the `resrch` repository,
`schemas/plugin/plugin-registry-index-v1.schema.json`). Hosts may fetch this
file over HTTPS; `package` locations that do not start with a scheme resolve
relative to the index location.

The build is append-only: each plugin entry preserves every published
`versions` entry, `latest` mirrors the newest one, and re-publishing a pinned
version with changed content fails (packages are immutable per
`(id, version)`; bump the version). Because version pins reference the
committed `dist/` artifacts, a pinned package that has been deleted must be
restored from git (`git checkout <rev> -- dist/…`) — the builder refuses to
silently drop it.

CI deploys `registry/index.json` plus `dist/` to GitHub Pages on every push
to `main`; the in-app marketplace fetches the index from that site and
resolves the relative `dist/…` package paths against it. The catalog is
**committed, not built on the fly**: CI rebuilds it from `plugins/` and
fails the run when the rebuild changes anything under `registry/` or
`dist/`, so every deploy is reproducible from a fresh clone and a version
bump always lands together with its committed package. Run
`rdev plugin index --manifest <resrch-app>/i18n.toml` locally and commit
`registry/index.json` plus any new `dist/*.rplugin` in the same change.

## Signing

Deployments sign the catalog with Ed25519: `rdev plugin index --signing-key
… --key-id plugin-catalog-2026-09` writes the detached signature
`index.sig.json` beside the index, and CI verifies it against the pinned
public key (`OX3DVL0jACLzomauo5DqJaAt/aZdbrECRVQ8Ng13iSE=`) before staging
the site. The app requires a valid signature for the default catalog URL
before trusting the index and its package pins; private/local registries set
through `RESRCH_PLUGIN_REGISTRY_URL` may stay unsigned. The private half of
the key lives only in this repository's `PLUGIN_CATALOG_SIGNING_KEY` secret
(generated with `rdev plugin keygen`); rotation ships a new key id with an
app update.
