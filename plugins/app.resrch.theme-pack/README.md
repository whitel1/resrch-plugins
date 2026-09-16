# Resrch Official Themes

Three complete product UI themes that appear in **Settings → Appearance** and
the app menu theme submenu once the plugin is enabled:

| Theme | Mode | Palette |
| --- | --- | --- |
| Nord | dark | Polar-night slate surfaces, frost-blue primary, muted aurora accents |
| Rosé Pine | dark | Muted violet-dark surfaces, foam primary, love/gold/pine accents |
| Warm Paper | light | Warm paper surfaces, sage primary, amber accents |

Each file is a full gpui-kit `ThemeSet` document: all 140 semantic color keys,
editor highlight chrome, and syntax colors carried over from the product base
themes so code stays readable. The themes are derived from the product base
palette (neutrals snapped to a per-theme lightness ramp, accents re-hued per
family), which keeps active/hover/on-color relationships intact.

Theme files are picked up from the installed plugin directory and hot-reload
when the plugin set changes; use **Settings → Appearance** to select one.
