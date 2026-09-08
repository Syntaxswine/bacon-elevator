// The button panel (3 × 5 cells, four modes sharing the same grid) and the display band.
// The panel rebuilds its markup only when the mode or its shape changes (a signature); everything
// that changes within a mode — GO's disabled state, the lit floor, a choice's result — is patched
// in place, so a button never vanishes under a finger mid-tap.
import { label } from '../elevator.js'
import { isPassengerFloor } from '../trivia.js'
import { repair } from '../explain.js'
import { BLANK, fmt } from '../math.js'
import { STABLE } from '../state.js'

// The reducer refuses the bell and the top-bar Lobby by phase; the DOM must say so rather than
// leaving a live-looking control that does nothing.
const busy = (state) => !STABLE.has(state.phase) && state.phase !== 'lobby'

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const OPS = { '+': 'add', '−': 'sub', '×': 'mul', '÷': 'div', '▲': 'up', '▼': 'down' }
export const LETTERS = ['A', 'B', 'C']

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

function tagFloors(state) {
  const r = state.ride
  const out = []
  for (let f = 1; f <= 9; f++) if (isPassengerFloor(f, state.settings.passengers) && !(r && r.passengersDone.includes(f))) out.push(f)
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
    `<button class="cell key bell" data-bell data-tap ${busy(state) ? 'disabled' : ''} aria-label="Rules">🔔</button>`,
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
    `<button class="cell key" data-key="back" data-tap aria-label="Delete last digit">⌫</button>`,
    digit(7), digit(8), digit(9),
    digit(4), digit(5), digit(6),
    digit(1), digit(2), digit(3),
    digit(0),
    `<button class="cell key go" data-key="go" data-tap ${canGo ? '' : 'disabled'} aria-label="Go">GO</button>`,
  ].join('')
}

function patchKeypad(container, state) {
  const r = state.ride
  const go = container.querySelector('button[data-key="go"]')
  if (go) go.disabled = !/\d/.test(r ? r.typed : '')
  const hint = container.querySelector('button[data-key="hint"]')
  if (hint) hint.setAttribute('aria-pressed', state.hint ? 'true' : 'false')
}

// ---- card mode (repair) ----------------------------------------------------------------
function card(state) {
  const r = state.ride
  const rep = repair(r.problem, r.typedWrong)
  return [
    `<div class="card" role="region" aria-label="Repair card"><div class="inner">`,
    `<div class="big">${equationHTML(r.problem.text, '', r.problem.answer)}</div>`,
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
      case 'floor': set(`Press ${esc(label(r ? r.target : 1))}`, 'text', state.message || doorsLine(state)); break
      case 'keypad': set(equationHTML(r.problem.text, r.typed), '', state.message || (r.retrying ? 'Same sum. Ride back up.' : '')); break
      case 'moving': set(r && r.problem ? equationHTML(r.problem.text, '', r.problem.answer) + '<span class="tick"> ✓</span>' : 'Going up', r && r.problem ? '' : 'text', ''); break
      case 'falling': set(r && r.problem ? equationHTML(r.problem.text, '', r.problem.answer) : '', '', ''); break
      case 'pit': case 'repair': set('Safety brake on.', 'text small', 'Nobody is hurt. Nothing is lost.'); break
      case 'trivia': set('A passenger asks:', 'text small', ''); break
      case 'fact': {
        const t = state.trivia
        if (t && t.result === 'right') set('That is right.', 'text small', '+2 bacon')
        else set(`The answer is ${t ? LETTERS[t.answer] : ''}.`, 'text small', '')
        break
      }
      case 'descending': set('Going down', 'text', ''); break
      case 'roof': set('Roof', 'text', ''); break
      default: set('', 'text', '')
    }
  }
  return { render, fit: () => fit(questionEl) }
}
