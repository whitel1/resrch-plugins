# Benchmark Samples

The official **benchmark provider** reference plugin for Resrch. It declares
one `[[benchmark_providers]]` contribution whose refresh command answers with
a `contribute_benchmark_results` action — the full contribution pipeline in
miniature:

- the host's benchmarks view shows a **Refresh providers** button (and an
  optional scheduled refresh, `library.benchmark_provider_refresh_interval_minutes`),
- the refresh runs the provider's declared `[[commands]]` entry,
- the command responds with one `contribute_benchmark_results` action carrying
  five sample rows,
- the host bounds the payload, permission-checks `benchmark.contribute`, and
  lands every row in the **pending review queue** as `external` results
  sourced to `app.resrch.benchmark-samples` — nothing enters a leaderboard
  until the user confirms it there,
- the plugin details page lists the provider under *Benchmark providers* and
  carries the per-plugin **Benchmark contributions** switch that closes the
  channel (refreshes skip the plugin and its actions are rejected).

## The sample rows

Five landmark ImageNet-1k top-1 accuracies (ResNet-50/101/152, DeiT-Base,
ViT-L/16), rounded to one decimal from paper-reported or official reference
checkpoints. They are a pipeline demonstration, not a curated leaderboard:
papers resolve in the host library by arXiv id, then DOI, then title, so rows
whose paper is not in the library stay unmatched and never confirm. Verify the
values in the pending queue before accepting them.

## Layout

```
plugin.toml        manifest v2 (shell engine, provider contribution, permissions)
main.js            default-exports the panel View; answers queued invocations
locales/*.yml      flat locale files (Locale.* metadata + Plugin.* keys)
```

## Install

Package the directory and install it through the Extensions panel, or copy it
into an installed-plugins root:

```bash
rdev plugin package plugins/app.resrch.benchmark-samples --out dist/
rdev plugin check   --manifest ../resrch-app/i18n.toml plugins/app.resrch.benchmark-samples
```

The plugin requests a single permission grant (`benchmark.contribute`), which
the host reviews at activation.
