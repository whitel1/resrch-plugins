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
resolves the relative `dist/…` package paths against it.
