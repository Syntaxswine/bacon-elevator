// Scenarios for tools/phone-drive.mjs. Each scenario gets a ctx:
//   ctx.page   puppeteer Page at a phone viewport (touch enabled)
//   ctx.goto(hash?)   load the game (waits for load + one animation frame)
//   ctx.shot(name)    screenshot to shots/ when --shots is on
//   ctx.errors        console/page/network errors collected so far (any → FAIL unless allowErrors)
//   ctx.phone / ctx.key   the phone profile
// Return a short string for the report, or throw to fail.
//
// The game-specific scenarios are added once the DOM contract in docs/DESIGN.md exists.

export const scenarios = [
  {
    name: 'smoke',
    async run({ page, goto, shot }) {
      await goto()
      const title = await page.title()
      if (!title) throw new Error('page has no <title>')
      const meta = await page.$eval('meta[name="viewport"]', (m) => m.content).catch(() => null)
      if (!meta || !/width=device-width/.test(meta)) throw new Error('missing/incorrect viewport meta: ' + meta)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
      if (overflow) throw new Error('page scrolls horizontally at this viewport')
      await shot('loaded')
      return `title="${title}"`
    },
  },
]
