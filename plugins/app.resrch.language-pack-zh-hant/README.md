# 繁體中文 (Traditional Chinese) Language Pack

Official Traditional Chinese product language pack for Resrch, written for
Taiwan/Hong Kong/Macau users (`zh-Hant`, script-based so `zh-Hant-TW`,
`zh-HK`, and `zh-TW` platform preferences all resolve to it).

## Coverage

`coverage = "complete"`: all product keys (2,548 at pack version 1.0.0) are
translated. When the product grows and this pack lags, missing keys fall back
through the app's declared chain — `zh-Hant → zh-CN → en` — so the UI stays
Chinese while the pack catches up; the Extensions panel reports the exact
coverage percentage.

The locale also participates in platform-locale negotiation: with the pack
enabled, a `zh-Hant` system preference selects it at startup (the `ui.locale`
setting stays empty to keep following the platform).

## Regeneration

The catalog is generated from the zh-CN product catalog with OpenCC `s2twp`
plus a terminology pass (檔案/設定/預設/支援/列印/匯入/匯出/後台/目前/拖曳…).
Character conversion is mechanical; nuanced strings should still get a human
terminology review:

```bash
rdev plugin check --manifest ../resrch-app/i18n.toml plugins/app.resrch.language-pack-zh-hant
```

Update the pack by re-running the conversion against the new catalog and
bumping `version`; packages are immutable per `(id, version)`.
