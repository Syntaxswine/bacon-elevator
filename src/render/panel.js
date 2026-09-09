// The button panel (3 × 5 cells, four modes sharing the same grid) and the display band.
// The panel rebuilds its markup only when the mode or its shape changes (a signature); everything
// that changes within a mode — GO's disabled state, the lit floor, a choice's result — is patched
// in place, so a button never vanishes under a finger mid-tap.
import { label } from '../elevator.js'
import { isPassengerFloor, CHOICE_LETTERS } from '../trivia.js'
import { repair } from '../explain.js'
import { BLANK, fmt } from '../math.js'
import { STABLE } from '../state.js'

// The reducer refuses the bell and the top-bar Lobby by phase; the DOM must say so rather than
// leaving a live-looking control that does nothing.
const busy = (state) => !STABLE.has(state.phase) && state.phase !== 'lobby'

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const OPS = { '+': 'add', '−': 'sub', '×': 'mul', '÷': 'div', '▲': 'up', '▼': 'down' }
// One definition, in src/trivia.js, so the fact card can name the answer by the same letter the
// display band does (r3-autism-fit-01).
export const LETTERS = CHOICE_LETTERS

// The equation as spans: colour-coded, shape-distinct operators; the blank shows what was typed.
export function equationHTML(text, typed, done) {
  return text.split(' ').map((tok) => {
    if (tok === BLANK) {
      if (done !== undefined) return `<span class="blank filled">${esc(fmt(done))}</span>`
      const t = String(typed || '').replace('-', '−')
      return `<span class="blank${t ? '' : ' empty'}">${esc(t)}</span>`
    }
    if (OPS[tok]) return `<span class="op op-${OPS[tok]}" aria-label="${OPS[tok]}">${tok}</span>`
    return `<span class="n">${esc(tok)}</span>`
  }).join(' ')
}

export function createPanel(container) {
  let sig = null
  function render(state, ctx) {
    const mode = modeOf(state)
    const s = signature(state, ctx, mode)
    if (s !== sig) {
      sig = s
      container.dataset.mode = mode
      container.innerHTML = mode === 'keypad' ? keypad(state, ctx) : mode === 'card' ? card(state) : mode === 'trivia' ? trivia(state) : floorMode(state, ctx)
    }
    if (mode === 'keypad') patchKeypad(container, state)
    else if (mode === 'trivia') patchTrivia(container, state)
    else if (mode === 'floor') patchFloor(container, state, ctx)
  }
  return { render, invalidate() { sig = null } }
}

function modeOf(state) {
  const r = state.ride
  if (state.phase === 'keypad' && r && r.problem) return 'keypad'
  if (state.phase === 'repair' && r && r.problem) return 'card'
  if ((state.phase === 'trivia' || state.phase === 'fact') && state.trivia) return 'trivia'
  return 'floor'
}

// Exported so the reachability rule can be measured without a DOM (test/round6.test.js).
export function tagFloors(state) {
  const r = state.ride
  const out = []
  // The same gate arrive() applies before it offers a passenger: with no bank loaded there is
  // nobody to tag (r3-code-hostile-04).
  if (!state.pool || !state.pool.length) return out
  // A ? BADGE IS A PROMISE THE BUILDING CAN STILL KEEP (r6-code-hostile-4). The cadence and
  // `passengersDone` were the whole rule, with no reference to where the car is, so a grown-up
  // switching Passengers from Sometimes to Often mid-building put a badge on floors the car had
  // already passed — floor 3 marked while the car sits at 5, and a lift that only ever goes up.
  // arrive() offers a passenger at the floor it REACHES, so a floor at or below the car is a
  // passenger nobody can meet again in this building.
  const above = r ? r.floor + 1 : 1
  for (let f = Math.max(1, above); f <= 9; f++) if (isPassengerFloor(f, state.settings.passengers) && !(r && r.passengersDone.includes(f))) out.push(f)
  return out
}

// What forces a rebuild: the mode, and within it only the parts that are not patched.
function signature(state, ctx, mode) {
  const r = state.ride
  switch (mode) {
    case 'keypad': return `keypad:${ctx && ctx.negatives ? 1 : 0}`
    case 'card': return `card:${r.problem.key}:${r.typedWrong}:${r.tries}`
    case 'trivia': return `trivia:${state.trivia.fact.id}:${state.trivia.choices.join('|')}`
    default: return `floor:${tagFloors(state).join(',')}`
  }
}

// ---- floor mode -------------------------------------------------------------------------
function floorFlags(f, state) {
  const r = state.ride
  const isTarget = !!r && r.target === f
  return { isTarget, lit: isTarget && state.car.carCall === f, live: isTarget && state.phase === 'floor' }
}

function floorButton(f, state) {
  const lab = label(f)
  const { isTarget, lit, live } = floorFlags(f, state)
  const tag = f >= 1 && f <= 9 && tagFloors(state).includes(f)
  const cls = ['cell', 'floor', isTarget && live ? 'target' : '', lit ? 'lit' : ''].filter(Boolean).join(' ')
  return `<button class="${cls}" data-floor="${lab}" data-tap ${live ? '' : 'disabled'} aria-label="Floor ${lab}${isTarget ? ', press to ride' : ''}"><span class="face">${lab}</span>${tag ? '<span class="tag" aria-label="passenger floor">?</span>' : ''}</button>`
}

function doorFlags(state, ctx) {
  const doorsOpen = state.car.doors === 'open' || state.car.doors === 'opening'
  const moving = state.phase === 'moving'
  return { canOpen: (state.phase === 'floor' && !doorsOpen) || (moving && !!(ctx && ctx.doorsClosing)), canClose: state.phase === 'floor' && doorsOpen }
}

function floorMode(state, ctx) {
  const { canOpen, canClose } = doorFlags(state, ctx)
  return [
    // A CAPTION, not a bare glyph. The one route back to the Rules card was an unlabelled bell —
    // and on a real elevator panel the bell is the ALARM, so for this audience the button that opens
    // the instructions looked like the one you are told not to press. Its row-mate HINT has carried
    // a word all along; this now matches it, and the lobby carries a `How it works` button as well.
    `<button class="cell key bell" data-bell data-tap ${busy(state) ? 'disabled' : ''} aria-label="Rules">🔔 RULES</button>`,
    floorButton(10, state),
    `<div class="cell spacer" aria-hidden="true"></div>`,
    floorButton(7, state), floorButton(8, state), floorButton(9, state),
    floorButton(4, state), floorButton(5, state), floorButton(6, state),
    floorButton(1, state), floorButton(2, state), floorButton(3, state),
    floorButton(0, state),
    `<button class="cell key door-key" data-door="open" data-tap ${canOpen ? '' : 'disabled'} aria-label="Open doors">◁▷</button>`,
    `<button class="cell key door-key" data-door="close" data-tap ${canClose ? '' : 'disabled'} aria-label="Close doors">▷◁</button>`,
  ].join('')
}

function patchFloor(container, state, ctx) {
  for (const b of container.querySelectorAll('button[data-floor]')) {
    const lab = b.dataset.floor
    const f = lab === 'G' ? 0 : lab === 'R' ? 10 : parseInt(lab, 10)
    const { isTarget, lit, live } = floorFlags(f, state)
    b.classList.toggle('target', isTarget && live)
    b.classList.toggle('lit', lit)
    b.disabled = !live
    const aria = `Floor ${lab}${isTarget ? ', press to ride' : ''}`
    if (b.getAttribute('aria-label') !== aria) b.setAttribute('aria-label', aria)
  }
  const bell = container.querySelector('[data-bell]')
  if (bell) bell.disabled = busy(state)
  const { canOpen, canClose } = doorFlags(state, ctx)
  const open = container.querySelector('button[data-door="open"]')
  const close = container.querySelector('button[data-door="close"]')
  if (open) open.disabled = !canOpen
  if (close) close.disabled = !canClose
}

// ---- keypad mode ------------------------------------------------------------------------
function keypad(state, ctx) {
  const r = state.ride
  const typed = r ? r.typed : ''
  const canGo = /\d/.test(typed)
  const sign = ctx && ctx.negatives ? `<button class="cell key small-label" data-key="sign" data-tap aria-label="Plus or minus">±</button>` : `<div class="cell spacer" aria-hidden="true"></div>`
  const digit = (d) => `<button class="cell key" data-key="${d}" data-tap aria-label="${d}">${d}</button>`
  return [
    `<button class="cell key hint-key" data-key="hint" data-tap aria-label="Hint" aria-pressed="${state.hint ? 'true' : 'false'}">HINT</button>`,
    sign,
    `<button class="cell key" data-key="back" data-tap ${typed ? '' : 'disabled'} aria-label="Delete last digit">⌫</button>`,
    digit(7), digit(8), digit(9),
    digit(4), digit(5), digit(6),
    digit(1), digit(2), digit(3),
    digit(0),
    `<button class="cell key go" data-key="go" data-tap ${canGo ? '' : 'disabled'} aria-label="Go">GO</button>`,
  ].join('')
}

function patchKeypad(container, state) {
  const r = state.ride
  const typed = r ? r.typed : ''
  const go = container.querySelector('button[data-key="go"]')
  if (go) go.disabled = !/\d/.test(typed)
  // A LIT, UNDIMMED KEY THAT DOES NOTHING IS A DEAD KEY (r5-math-06, the rule src/state.js states
  // for the digit keys past the cap). ⌫ on an empty entry returned same(state): no digit, no
  // sound, no message, and no dimming to say why - the one key on the panel that was live, looked
  // live and answered nothing. Measured at 20 142 such taps in an 11.4M-tap walk. Same treatment as
  // GO, which has been disabled on an empty entry all along.
  const back = container.querySelector('button[data-key="back"]')
  if (back) back.disabled = !typed
  const hint = container.querySelector('button[data-key="hint"]')
  if (hint) hint.setAttribute('aria-pressed', state.hint ? 'true' : 'false')
}

// ---- card mode (repair) ----------------------------------------------------------------
function card(state) {
  const r = state.ride
  const rep = repair(r.problem, r.typedWrong)
  // The headline is mono, so its width is its character count. 12 characters is what a 320 px card
  // holds at 34/18 with Bigger text on; past that it wrapped to a second line and pushed the clause
  // off the bottom (r6-math-02). Two steps, so a Custom ceiling's `9110 − 7600 = 1510` fits too.
  const bigLen = rep.big.length
  return [
    `<div class="card" role="region" aria-label="Repair card"><div class="inner">`,
    `<div class="big${bigLen > 15 ? ' longer' : bigLen > 12 ? ' long' : ''}">${equationHTML(r.problem.text, '', r.problem.answer)}</div>`,
    `<div class="small">${esc(rep.small)}</div>`,
    `<div class="worked${rep.worked.length > 56 ? ' long' : ''}">${esc(rep.worked)}</div>`,
    `<div class="clause">${esc(rep.clause)}</div>`,
    `</div></div>`,
    `<button class="cell key continue" data-continue data-tap aria-label="Try again">Try again</button>`,
  ].join('')
}

// ---- trivia mode -------------------------------------------------------------------------
function choiceResult(t, i) {
  if (t.result === null) return ''
  return i === t.answer ? 'right' : i === t.chosen ? 'chosen' : 'dim'
}

function trivia(state) {
  const t = state.trivia
  return [
    `<div class="tq">${esc(t.fact.q)}</div>`,
    ...t.choices.map((c, i) => `<button class="cell choice" data-choice="${i}" data-tap data-result="${choiceResult(t, i)}" ${t.result === null ? '' : 'disabled'} aria-label="${LETTERS[i]}: ${esc(c)}"><span class="letter" aria-hidden="true">${LETTERS[i]}</span><span class="ctext">${esc(c)}</span></button>`),
  ].join('')
}

function patchTrivia(container, state) {
  const t = state.trivia
  for (const b of container.querySelectorAll('button[data-choice]')) {
    const i = parseInt(b.dataset.choice, 10)
    const res = choiceResult(t, i)
    if (b.dataset.result !== res) b.dataset.result = res
    b.disabled = t.result !== null
  }
}

// ---- display band ------------------------------------------------------------------------
function floorName(f) {
  return f === 0 ? 'Ground floor' : f === 10 ? 'Roof' : f === -1 ? 'Pit' : `Floor ${f}`
}
// ▲ AND ▼ ARE OPERATORS ON THE NUMBER, NOT INSTRUCTIONS TO THE CAR (r3-math-04).
// The old gloss read `▼ means go down: take away.` while a correct answer sends the car UP one
// floor — and the only time the car obeys a ▼ is the fall onto the spikes. Same glyphs, opposite
// referents, on the screen the child reads before answering. The operators stay (DESIGN §86 ships
// them as the elevator-native form, and dropping ▼ would leave ▲ with the identical clash), but the
// sentence now says what moves: the NUMBER. The rules card's own line was changed to match.
//
// AND THE BLANK MOVES (r4-math-03). `a + ▮ = c` arrives at Corner Shop step 3 — question 7 of a
// fresh save, BEFORE the first ▲ — with nothing anywhere to say what the box in the middle is: the
// band was empty, the Rules card's two worked examples both put the blank at the end, and the one
// sentence that explains the form (explain.js's inverse clause) is on the Repair card, i.e. after
// two wrong answers and a fall. The other two invented forms are glossed twice over. This is the
// same one line, in the same place, for the form the game explains last.
const OP_GLOSS = {
  up: () => '▲ is add: the number goes up.',
  down: () => '▼ is take away: the number goes down.',
  missAdd: (p) => `▮ is the missing number: ${fmt(p.a)} and how many more make ${fmt(totalOf(p))}?`,
  missMul: (p) => `▮ is the missing number: how many ${fmt(p.b)}s make ${fmt(totalOf(p))}?`,
}
const totalOf = (p) => (Number.isInteger(p.c) ? p.c : p.kind === 'missMul' ? p.a * p.b : p.a + p.b)
// Exported so the layout instrument can measure the REAL sentence at the largest numbers the
// ladder can put in it, instead of keeping its own copy of the words (r6-math-01). A fixture
// that re-spells what it measures cannot catch that thing drifting.
export function opGloss(p) { return (p && OP_GLOSS[p.kind] ? OP_GLOSS[p.kind](p) : '') }
function doorsLine(state) {
  const open = state.car.doors === 'open' || state.car.doors === 'opening'
  return `${floorName(state.car.floor)}. Doors ${open ? 'open' : 'closed'}.`
}

export function createDisplay(questionEl, messageEl) {
  let lastQ = '', lastM = ''
  function set(html, cls, msg) {
    if (html !== lastQ) { questionEl.innerHTML = html; lastQ = html }
    questionEl.className = cls || ''
    const m = msg || ''
    if (m !== lastM) { messageEl.textContent = m; lastM = m }
    fit(questionEl)
  }
  function fit(q) {
    const parent = q.parentElement
    if (!parent) return
    q.style.fontSize = ''
    const avail = parent.clientWidth - 16
    if (avail <= 0) return
    const w = q.scrollWidth
    if (w > avail) q.style.fontSize = Math.max(18, Math.floor(parseFloat(getComputedStyle(q).fontSize) * (avail / w))) + 'px'
  }
  function render(state, transient) {
    if (transient) { set(transient.html, transient.cls, transient.msg); return }
    const r = state.ride
    switch (state.phase) {
      case 'floor': set(`Press ${esc(label(r ? r.target : 1))}`, 'text', state.message || state.stepNote || doorsLine(state)); break
      // ▲ and ▼ ARE OPERATORS THE GAME NEVER DEFINED. A quarter of first-ever questions use one,
      // the rules card only ever shows `7 + 5 = 12`, and the same two glyphs mean DIRECTION on the
      // hall calls and the lantern on the same screen. The gloss sits under the sum itself, where a
      // child who has just met the glyph is looking, and yields to any real message.
      // The one branch here that read `r.problem` with no guard, while its two neighbours and
      // modeOf() above all test `r && r.problem` first (r5-code-hostile-07). Unreachable today -
      // normaliseRide rewrites phase 'keypad' to 'floor' whenever problem is null - so this is the
      // asymmetry, not a live bug: it is the one place where a future save-shape change turns into
      // a blank screen instead of a floor.
      case 'keypad': set(r && r.problem ? equationHTML(r.problem.text, r.typed) : '', '', state.message || (r && r.retrying ? 'Same sum. Ride back up.' : (r && r.problem ? opGloss(r.problem) : ''))); break
      case 'moving': set(r && r.problem ? equationHTML(r.problem.text, '', r.problem.answer) + '<span class="tick"> ✓</span>' : 'Going up', r && r.problem ? '' : 'text', ''); break
      // THE 1.2 s BEFORE THE FALL WAS THE REWARD DISPLAY MINUS A TICK (r3-elevator-feel-01).
      // `moving` (a CORRECT answer) draws exactly this string plus a green ✓, and `.blank.filled`
      // had no rule of its own, so the true answer arrived in the same blue, on the same underline,
      // as the digits the child had just typed: the wrong 7 silently became a 10 and the car
      // dropped, with an empty message band. No cross and no red — the fall carries no punishing
      // copy anywhere (BRIEF §7) — but the true answer now has its own ink (`.truth`), and the band
      // says whose answer the vanished one was.
      case 'falling': set(r && r.problem ? equationHTML(r.problem.text, '', r.problem.answer) : '', 'truth', r && r.typedWrong ? `you pressed ${esc(r.typedWrong).replace('-', '−')}` : ''); break
      case 'pit': case 'repair': set('Safety brake on.', 'text small', 'Nobody is hurt. Nothing is lost.'); break
      case 'trivia': set('A passenger asks:', 'text small', ''); break
      case 'fact': {
        const t = state.trivia
        if (t && t.result === 'right') set('That is right.', 'text small', '+2 bacon')
        else set(`The answer is ${t ? LETTERS[t.answer] : ''}.`, 'text small', t ? t.choices[t.answer] : '')
        break
      }
      case 'descending': set('Going down', 'text', ''); break
      case 'roof': set('Roof', 'text', ''); break
      default: set('', 'text', '')
    }
  }
  return { render, fit: () => fit(questionEl) }
}
