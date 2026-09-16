# Français (French) Language Pack

Official French translation of the Resrch product UI. After installing and
enabling the plugin, **Français** appears in the title-bar language selector.

Coverage today: the product chrome — application menus, activity center,
status bar (including the Cloud states), notifications, the about/privacy/
licenses dialog, shared controls, and panel titles. Declared honestly as
`coverage = "partial"`; untranslated surfaces keep their English catalog
strings at runtime, and missing-key reports from `rdev plugin check` are the
work list for extending the pack.

To extend coverage, regenerate the key list against the product checkout and
translate the missing entries:

```bash
rdev plugin check --manifest ../resrch-app/i18n.toml plugins/app.resrch.language-pack-fr
```

A `coverage = "complete"` claim fails validation while any product key is
missing, so the manifest only flips to `complete` when the full catalog is
translated and the check passes.
