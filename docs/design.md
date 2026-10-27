# Interface decisions

Astra researched and designed the prototype on October 26, 2026. The brief was a Hacker News-style feed with game previews and Play buttons.

The initial design used a single-column feed. The preview, title, and Play button opened the creator's site in a new tab. No third-party games execute inside the directory.

Votes stay in place until the feed reloads.

## Arcade cabinet (October 27, 2026)

Claude designed and implemented the arcade treatment, followed by local browser checks and responsive fixes. The site is drawn as an upright cabinet in the style of a Pandora's Box multi-game machine: a backlit marquee, a CRT inside a black bezel, a control deck, and a coin door. The art is 2.5D pixel art: hard colour stops, unblurred shadows in 2px and 4px steps, stepped corners, and chrome made from banded gradients. The CSP allows no `data:` URIs and the server serves a fixed list of files, so every shape is CSS or inline SVG. The pixel logo in `index.html` is a 5 × 7 bitmap font with layered offsets for depth.

- Wide screens show a game-select menu. The list on the left is one tab stop; arrow keys, Home, and End move the selection. The selected game fills the rest of the screen with a large preview, its description, tags, vote, comments, and Play. The deck's joystick keys move the selection, the yellow button plays the selected game, the cyan button opens the rules, and the red coin button opens the submission form.
- Phones don't get a scaled-down cabinet. The marquee shrinks, the menu becomes a column of full-width cards with 16:9 previews and their own actions, and the deck becomes a sticky bottom bar with Rules and Submit.
- A game can appear in the menu, its phone card, and the selected-game screen at once. Vote and comment counts update on every copy.
- The "N in 1" badge counts the games loaded so far, with a "+" when more pages exist. It is hidden on phones to keep the marquee lettering clear.
- Comments are plain text in a service-menu dialog. There are no post numbers or quote styling.
- Text on the CRT is at least 12px. Scanlines are kept faint so body text stays readable. Blinking and boot animations only run when reduced motion is off.

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
