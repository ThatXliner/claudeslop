// Requires a running instance, Playwright, and an installed browser.
// PLAYWRIGHT_MODULE can point to an existing Playwright index.mjs outside this repo.
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const url = process.argv[2] || "http://127.0.0.1:4317";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_CHANNEL
    ? { channel: process.env.BROWSER_CHANNEL }
    : {}),
});
try {
  for (const [width, height] of [
    [1280, 720],
    [1366, 768],
    [1440, 900],
    [1920, 1080],
    [1024, 768],
    [900, 700],
    [768, 1024],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    try {
      await page.goto(url);
      await page.locator(".slot").first().waitFor();
      const check = async () => {
        const result = await page.evaluate(() => {
          const box = (selector) =>
            document.querySelector(selector).getBoundingClientRect();
          const cabinet = box(".cabinet");
          const play = box("#start-play");
          const detail = document.querySelector("#detail");
          return {
            pageFits:
              document.documentElement.scrollWidth <= innerWidth &&
              document.documentElement.scrollHeight <= innerHeight,
            cabinetFits:
              cabinet.top >= 0 &&
              cabinet.bottom <= innerHeight &&
              cabinet.left >= 0 &&
              cabinet.right <= innerWidth,
            playFits: play.top >= 0 && play.bottom <= innerHeight,
            detailFits: detail.scrollHeight <= detail.clientHeight + 1,
            controlsClear: [
              ...document.querySelectorAll(
                "#detail .vote, #detail .comment-count, #detail .play, #start-play, #open-submit",
              ),
            ].every((node) => {
              const rect = node.getBoundingClientRect();
              const hit = document.elementFromPoint(
                rect.x + rect.width / 2,
                rect.y + rect.height / 2,
              );
              return hit === node || node.contains(hit);
            }),
          };
        });
        for (const [name, passed] of Object.entries(result)) {
          if (!passed)
            throw new Error(
              `${width}×${height}: ${name} failed for ${await page.locator(".slot[aria-current] .slot-title").innerText()}`,
            );
        }
      };
      await check();
      // Exercise every real game's title, description, and tag combination.
      for (const slot of await page.locator(".slot").all()) {
        await slot.click();
        await check();
      }
      const list = page.locator(".list-pane");
      const needsScroll = await list.evaluate(
        (node) => node.scrollHeight > node.clientHeight,
      );
      if (needsScroll) {
        await list.evaluate((node) => {
          node.scrollTop = 0;
        });
        await list.hover();
        await page.mouse.wheel(0, 600);
        await page.waitForFunction(
          () => document.querySelector(".list-pane").scrollTop > 0,
        );
        if ((await page.evaluate(() => scrollY)) !== 0)
          throw new Error(`${width}×${height}: list scrolling moved the page`);
      }
      console.log(
        `${width}×${height}: cabinet and game details fit; list scrolls independently`,
      );
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
