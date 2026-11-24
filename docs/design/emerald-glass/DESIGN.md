# Sahaba — Emerald Glass (R8)

**Light mode = المرجع.** `reference/light.html` + `screenshots/light.png`.
**Dark mode = نفس الأشكال والأيقونات بالظبط، بألوان "زجاج المساء".** `reference/dark.html` + `screenshots/dark.png`.
افتح ملفي الـ HTML في المتصفح — هما المصدر النهائي لأي قياس أو لون.

## 1. Principles
1. Glass panels float over a soft **ambient light layer** (blurred orbs). Without the ambient layer the glass looks flat — it is mandatory in the app shell.
2. Only ONE blur level: top-level panels get `.glass`; anything inside them is `.glass-well` (flat translucent, no blur).
3. Green is for action only (primary button, active tab, progress, live). Sand (`--accent`) is for small labels, kickers, section numbers.
4. Light and dark share **identical radii, sizes, icons and layouts**. Only tokens change. No component may branch on theme.
5. Fonts unchanged: Liftaswash for page titles, hero title and KPI numbers only; IBM Plex Sans Arabic for everything else.

## 2. Shape rules (do NOT take these from the old Morning-Glass dark design)
| Element | Radius | Size |
|---|---|---|
| Button | 14 | h 48 / sm 38 / lg 56, px 22 |
| Hero CTA, badge, segmented control, switch | full | badge h 30, seg item h 40 |
| Input / select | 14 | h 50, icon at inline-start +14 |
| Checkbox | 7 | 20×20 |
| Icon tile (KPI, toast, empty art) | 14 (empty art 28) | 38–40 / 84 |
| Section card, KPI card | 28 | padding 30 / 22 |
| Nested well (row, course card, who-card) | 20 | — |
| Toast | 24 | — |
| Hero | 36 | min-h 290, padding 48×52 |
| Avatar | circle | 44 / lg 56 / sm 32, ring `0 0 0 2px` glass border |

- **No `corner-shape: squircle`** (that was Morning Glass only).
- **Icon tiles are TINTED, not solid**: `background: var(--primary-subtle); color: var(--primary)` (warning tile uses `--warning-subtle` / `--warning`). Solid colored tiles (blue/orange/brown) from Morning Glass are removed.
- Icons: lucide, stroke 1.75, 18px (15 inside meta rows, 32 in empty state). Same set in both modes.
- Tabs: underline style (2px `--primary`), NOT the dot style.
- Avatars: gradient fills t1 emerald, t2 sand, t3 blue, t4 glass — same in both modes.

## 3. Components (map to apps/web/src/components/ui)
- **button**: variants primary(.btn-primary) / secondary(glass-strong bg + glass border) / outline(primary 45% border) / ghost / danger(danger-subtle). Loading = 60% opacity + spinner.
- **input / select / textarea**: bg `--glass-bg-flat`, border `--glass-border`, inset shadow; focus → `--surface-raised` bg + primary border + `--focus-ring`; error → danger border + danger-subtle bg + message with alert icon.
- **switch**: 46×28, knob 22, checked = `--primary`.
- **badge**: pill, tinted subtle bg + subtle-fg; `live` = solid primary with glowing dot (`--live-dot`).
- **tabs**: segmented (pill, seg-on = `--glass-bg-strong` + shadow) and underline.
- **kpi-card / stat-card**: `.glass` r28; icon tile + label row, Liftaswash number 48px in `--fg-strong`, unit 15px, delta colored (success/warning) + note.
- **card**: `.glass` r28 p30; header = sand number + bold 17px title.
- **progress-bar**: h10 pill, track `--surface-muted`, fill `--progress-fill`.
- **toast**: `.glass` r24, tinted icon tile, title 15 bold, sub 13, close = round ghost.
- **empty-state**: centered; 84px glass icon tile r28; title 18 bold; text 14 muted; secondary small button. No dashed borders.
- **Hero / continue-learning**: `.glass` r36; kicker in `--accent`; Liftaswash 44px title; pill CTA.

## 4. Fixes carried over from the audit
- `info` is now **blue** (was olive/lime) — no more 3 greens.
- One number system across the UI (via `lib/format.ts`).
- Loading button must stay readable (≥4.5:1 text).
- Remove the brown underline under page titles and the dashed empty-state box.

## 5. Performance & a11y
- Max ~12 `.glass` elements per viewport; tables/lists use `.glass-well` rows.
- `prefers-reduced-transparency` and no-backdrop-filter fallbacks are in `glass.css`.
- Text contrast ≥ 4.5:1 on glass in both modes (tokens are already chosen for this).
