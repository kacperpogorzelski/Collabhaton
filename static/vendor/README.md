# static/vendor — lokalne biblioteki frontendu (offline-safe)

Pliki pobrane **jednorazowo** i trzymane w repo (docs/01 §5, AGENTS.md §3): strona nie ładuje
niczego z CDN w runtime. Nie aktualizować bez uzgodnienia (przypięte wersje).

| Plik | Wersja | Źródło (jednorazowe pobranie) |
| :--- | :--- | :--- |
| `chart.umd.min.js` | Chart.js `4.4.4` | `chart.js@4.4.4/dist/chart.umd.js` (oficjalny plik UMD, już zminifikowany) |
| `confetti.browser.min.js` | canvas-confetti `1.9.3` | `canvas-confetti@1.9.3/dist/confetti.browser.js` (minifikacja jsDelivr) |
| `fonts/BricolageGrotesque-{700,800}.woff2` | Bricolage Grotesque (Fontsource `5.2.8`) | podzbiór `latin` — nagłówki, liczniki XP, odznaki |
| `fonts/BricolageGrotesque-{700,800}-latin-ext.woff2` | jw. | podzbiór `latin-ext` (polskie znaki) |
| `fonts/PlusJakartaSans-{400,500,600,700,800}.woff2` | Plus Jakarta Sans (Fontsource `5.2.5`) | podzbiór `latin` — tekst UI |
| `fonts/PlusJakartaSans-{400,500,600,700,800}-latin-ext.woff2` | jw. | podzbiór `latin-ext` (polskie znaki) |
| `fonts/OFL.txt` | — | licencja SIL Open Font License 1.1 (wymagana przy dystrybucji obu fontów — nie usuwać) |

Pliki npm (`chart.umd.js`, `confetti.browser.js`) zweryfikowano sumą SHA-256 z API jsDelivr.
`@font-face` znajduje się w `static/styles.css`.

> **UI overhaul (v13):** Tailwind Play i Lucide zostały usunięte — cały design system jest w
> `static/styles.css`, a ikony (2-tone, obrys 2 px) i maskotka Cora (inline SVG) w `static/app.js`.
