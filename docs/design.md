# Interface decisions

Astra researched and designed the prototype on October 26, 2026. The brief was a Hacker News-style feed with game previews and Play buttons.

The main job is finding a game to play. A single column keeps titles, descriptions, votes, and links easy to scan. There is no marketing hero or featured carousel. The preview, title, and Play button open the creator's site in a new tab. No third-party games execute inside the directory.

The desktop frame is 1040px wide with 168 × 105px previews. Phones use 96 × 64px previews and a separate action row. System fonts avoid a font download. The orange accent marks the brand, submission action, and selected votes. Votes stay in place until the feed reloads.

The initial scope is Hot, New, Submit, vote toggling, guidelines, and command-line moderation. Hot sorts by `(votes + 1) / (age in hours + 2)^1.35`. New sorts by submission time. Curated entries start with zero votes and link to the creator's AI attribution. Their time is when they were added here, not the game's release date.

## Research

- [Hacker News newest](https://news.ycombinator.com/newest): title and metadata hierarchy.
- [itch.io browser games](https://itch.io/games/new-and-popular/platform-web): visual previews and direct browser play.
- [WCAG contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): at least 4.5:1 for normal text.
- [WCAG target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): 24px minimum with exceptions. Main game actions use 44px targets.
- [WCAG focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html): visible focus, native modal dialogs, and a skip link.

The design-taste-frontend app-screen guidance informed the flat surfaces, restrained typography, and honest counts. Browser checks use the control-ui skill. These references informed the design; they are not a claim of a complete accessibility audit.

## Curated games

See `seeds.json` for live game and preview URLs. Each entry has a source link explaining the creator's AI use. Ports are described as ports, with credit to the original game creators. Preview artwork belongs to its respective creator. Most previews link to their creator’s own images. The Quake preview is a gameplay capture from the linked browser port; original game art belongs to id Software.
