# static/vendor — lokalne biblioteki frontendu (offline-safe)

Pliki pobrane **jednorazowo** i trzymane w repo (docs/01 §5, AGENTS.md §3): strona nie ładuje
niczego z CDN w runtime. Nie aktualizować bez uzgodnienia (przypięte wersje).

| Plik | Wersja | Źródło (jednorazowe pobranie) |
| :--- | :--- | :--- |
| `tailwind.js` | Tailwind CSS Play CDN `3.4.17` | `https://cdn.tailwindcss.com/3.4.17` |
| `chart.umd.min.js` | Chart.js `4.4.4` | `chart.js@4.4.4/dist/chart.umd.js` (oficjalny plik UMD, już zminifikowany) |
| `confetti.browser.min.js` | canvas-confetti `1.9.3` | `canvas-confetti@1.9.3/dist/confetti.browser.js` (minifikacja jsDelivr) |
| `lucide.min.js` | Lucide `0.460.0` | `lucide@0.460.0/dist/umd/lucide.min.js` |
| `fonts/PlusJakartaSans-{400,500,600,700,800}.woff2` | Plus Jakarta Sans (Fontsource `5.2.5`) | podzbiór `latin` |
| `fonts/PlusJakartaSans-{400,500,600,700,800}-latin-ext.woff2` | jw. | podzbiór `latin-ext` (polskie znaki) |
| `fonts/OFL.txt` | — | licencja SIL Open Font License 1.1 |

Pliki npm (`chart.umd.js`, `confetti.browser.js`, `lucide.min.js`) zweryfikowano sumą SHA-256
z API jsDelivr dla danej wersji pakietu. `@font-face` znajduje się w `static/styles.css`.

> Tailwind Play CDN wypisuje w konsoli ostrzeżenie „should not be used in production" —
> to oczekiwane (zero build-toola to świadoma decyzja SSOT); skrypt nie wykonuje żądań sieciowych.
