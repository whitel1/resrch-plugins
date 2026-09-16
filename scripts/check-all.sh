#!/usr/bin/env bash
# Validates every plugin in plugins/ against the current contract.
#
# Product-locale coverage checks need the product i18n manifest, so the script
# looks for a resrch-app checkout beside this repository and passes --manifest
# when found.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

manifest_args=()
for candidate in ../resrch-app/i18n.toml ../resrch-app/apps; do
  if [[ -f "$candidate" ]]; then
    manifest_args=(--manifest ../resrch-app/i18n.toml)
    break
  fi
done

status=0
for plugin_dir in plugins/*/; do
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
