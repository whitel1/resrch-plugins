# registry/

`index.json` is **generated** by `scripts/build_registry.py` from the plugins
under `../plugins/`. Never edit it by hand.

Schema: `plugin-registry-index-v1` (see the `resrch` repository,
`schemas/plugin/plugin-registry-index-v1.schema.json`). Hosts may fetch this
file over HTTPS; `package` locations that do not start with a scheme resolve
relative to the index location.
