#!/usr/bin/env bash
# Validates every plugin in plugins/ (plus staged community submissions under
# plugins/community/) against the current contract.
#
# Product-locale coverage checks need the product i18n manifest, so the script
# looks for a resrch-app checkout beside this repository and passes --manifest
# when found. CI checks the siblings out side by side inside the workspace
# (../resrch-app from this repository); the flat layout (resrch-app/ inside the
# repository root) is also accepted. Locally a missing checkout downgrades to a
# warning, but in CI it is fatal: shipping language packs without coverage
# validation must never look green.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

# `apps/` presence (without the manifest) still proves the checkout is there,
# and passing the manifest path anyway makes rdev fail loudly instead of
# silently skipping coverage when the manifest moves.
manifest_args=()
for base in ../resrch-app resrch-app; do
  if [[ -f "$base/i18n.toml" || -d "$base/apps" ]]; then
    manifest_args=(--manifest "$base/i18n.toml")
    break
  fi
done
if [[ ${#manifest_args[@]} -eq 0 ]]; then
  if [[ ${GITHUB_ACTIONS:-} == true ]]; then
    echo "no resrch-app checkout found beside this repository;" \
      "product locale coverage cannot run in CI" >&2
    exit 1
  fi
  echo "warning: no resrch-app checkout beside this repository;" \
    "checking without the product i18n manifest" >&2
fi

# Community plugins under plugins/community/ are validated but not published:
# the catalog builder only scans plugins/ one level deep, so a maintainer
# promotes a submission by moving it to plugins/ top level.
shopt -s nullglob
plugin_dirs=(plugins/*/ plugins/community/*/)
shopt -u nullglob

status=0
for plugin_dir in "${plugin_dirs[@]}"; do
  [[ -f "$plugin_dir/plugin.toml" ]] || continue
  echo "== rdev plugin check $plugin_dir"
  if ! rdev plugin check "${manifest_args[@]}" "$plugin_dir"; then
    status=1
  fi
done

if [[ $status -ne 0 ]]; then
  echo "plugin check failed" >&2
  exit 1
fi
echo "all plugins passed"
