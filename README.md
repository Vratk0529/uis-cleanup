# UIS STUBA – prehľadnejší dashboard

A Tampermonkey userscript that declutters the **UIS** (Univerzitný informačný systém) at
[is.stuba.sk](https://is.stuba.sk/) and puts the two things students actually open it for —
**grades and the timetable** — on the front page.

The stock personal administration page spends its space on a 170 px decorative header, a wall of
notices, and a section full of browser games. This script trims all of that and adds a sticky
toolbar plus two data cards fetched straight from UIS.

> The script's UI is in Slovak, because UIS is. It also forces `lang=sk` on pages opened without an
> explicit language, so an account set to English still gets the Slovak interface.

## What it does

**Header**

- Shrinks the header from ~170 px down to a single 46 px row.
- Drops the giant "Slovenská technická univerzita" banner, the faculty link bar, and the name-day text.
- Moves date, logged-in user, log-out and the language flags into that one row.
- Makes the STU logo a link back to the personal administration page.

**Sticky toolbar** — one row of direct links, always at the top:

| Link | Target |
| --- | --- |
| 📊 Známky | Priebeh štúdia |
| 🗓 Rozvrh | Osobný rozvrh |
| 🎓 Portál študenta | Moje štúdium |
| 📝 Termíny skúšok | Zoznam termínov |
| 📚 Materiály | Dokumentový server |
| ✉️ Pošta · 📄 Dokumenty · ✅ Úlohy | with unread counters lifted from the original header |

**Cards on the dashboard**

- **🗓 Rozvrh – najbližších 7 dní** — submits the timetable form in the background for today + 6 days
  and renders the result inline, restyled.
- **📊 Známky a kredity** — parses the E-index: subject code, name, form of completion, colour-coded
  grade, credits, plus credit totals and the period average.

Both cards fall back to a plain "open it directly in UIS" link if the fetch or parse fails.

**Cleanup**

- Hides the games section, UIS documentation, privacy notice, and the mobile-app promo by default.
- Reorders the remaining sections so *Moje štúdium* is first (via CSS `order`, so UIS's own
  drag & drop still works).
- Collapses notices and the noticeboard into a single `<details>` summary.
- Expands every section's hidden menu items and removes the "Ďalšie aplikácie" toggle.
- Removes the operational-info footer and the scroll arrows.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge, Safari).
2. Open [`uis-better.user.js`](uis-better.user.js) raw and Tampermonkey will offer to install it —
   or open the Tampermonkey dashboard → **+** → paste the file's contents → save.
3. Reload [is.stuba.sk](https://is.stuba.sk/auth/).

## Settings

The **⚙** button on the right of the toolbar opens a small panel:

- a checkbox per dashboard section, to show or hide it;
- toggles for the timetable card, the grades card, and collapsing the notices.

Section visibility applies immediately; the card toggles take effect on the next page load. Settings
are stored with `GM_setValue` and fall back to `localStorage` when the grants are unavailable.

Defaults live at the top of the script — `DEFAULT_HIDDEN` (hidden section ids) and `SECTION_ORDER`
(sort order) — if you would rather set them in code.

## Notes on the implementation

Nothing is scraped from a private API; the script re-uses the same pages the browser would load, with
`credentials: 'same-origin'`, and reads them with `DOMParser`.

Two quirks worth knowing if you plan to change it:

- **Query strings are fragile.** Passing a UIS URL through `URLSearchParams` reorders the parameters
  and the server answers with an empty page. Hrefs are therefore only resolved to an absolute path
  and otherwise left byte-for-byte alone.
- **The STU logo is a CSS background** of `#ie1`, not an `<img>`, so it cannot be hidden or wrapped;
  the link is a transparent overlay positioned on top of it.

## Compatibility

Written against the UIS layout as of 2025. It leans on UIS's own ids and class names (`#hlavicka`,
`#ie1`, `#ema`, `sekce-NN`, `#tmtab_1`, `.zasadka`, …), so a redesign upstream will break parts of it.
Each feature is independent — a broken card shows an error and a fallback link rather than taking the
page down.

Only pages under `https://is.stuba.sk/auth/*` are touched; the cards are built on the dashboard alone.

## Licence

MIT.
