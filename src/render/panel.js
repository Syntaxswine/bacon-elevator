// The button panel (3 × 5 cells, four modes sharing the same grid) and the display band.
import { label } from '../elevator.js'
import { isPassengerFloor } from '../trivia.js'
import { repair } from '../explain.js'
import { BLANK, fmt } from '../math.js'

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const OPS = { '+': 'add', '−': 'sub', '×': 'mul', '÷': 'div', '▲': 'up', '▼': 'down' }

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
  let last = ''
  function render(state, ctx) {
    const html = build(state, ctx)
    if (html === last) return
    last = html
    container.innerHTML = html
  }
  return { render, invalidate() { last = '' } }
}

function floorButton(f, state) {
  const r = state.ride
  const lab = label(f)
  const isTarget = r && r.target === f
  const lit = isTarget && state.car.carCall === f
  const live = isTarget && state.phase === 'floor'
  const tag = f >= 1 && f <= 9 && isPassengerFloor(f, state.settings.passengers) && !(r && r.passengersDone.includes(f))
  const cls = ['cell', 'floor', isTarget && live ? 'target' : '', lit ? 'lit' : ''].filter(Boolean).join(' ')
  return `<button class="${cls}" data-floor="${lab}" data-tap ${live ? '' : 'disabled'} aria-label="Floor ${lab}${isTarget ? ', press to ride' : ''}"><span class="face">${lab}</span>${tag ? '<span class="tag" aria-label="passenger floor">?</span>' : ''}</button>`
}

function build(state, ctx) {
  const phase = state.phase
  if (phase === 'keypad') return keypad(state, ctx)
  if (phase === 'repair') return card(state)
  if (phase === 'trivia' || phase === 'fact') return trivia(state)
  return floorMode(state, ctx)
}

function floorMode(state, ctx) {
  const doorsOpen = state.car.doors === 'open' || state.car.doors === 'opening'
  const moving = state.phase === 'moving'
  const canOpen = (state.phase === 'floor' && !doorsOpen) || (moving && !!(ctx && ctx.doorsClosing))
  const canClose = state.phase === 'floor' && doorsOpen
  return [
    `<button class="cell key bell" data-bell data-tap aria-label="Rules">🔔</button>`,
    floorButton(10, state),
    `<div class="cell spacer" aria-hidden="true">·</div>`,
    floorButton(7, state), floorButton(8, state), floorButton(9, state),
    floorButton(4, state), floorButton(5, state), floorButton(6, state),
    floorButton(1, state), floorButton(2, state), floorButton(3, state),
    floorButton(0, state),
    `<button class="cell key door-key" data-door="open" data-tap ${canOpen ? '' : 'disabled'} aria-label="Open doors">◁▷</button>`,
    `<button class="cell key door-key" data-door="close" data-tap ${canClose ? '' : 'disabled'} aria-label="Close doors">▷◁</button>`,
  ].join('')
}

function keypad(state, ctx) {
  const r = state.ride
  const typed = r ? r.typed : ''
  const canGo = /\d/.test(typed)
  const sign = ctx.negatives ? `<button class="cell key small-label" data-key="sign" data-tap aria-label="Plus or minus">±</button>` : `<div class="cell spacer" aria-hidden="true"></div>`
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

function card(state) {
  const r = state.ride
  const rep = repair(r.problem, r.typedWrong)
  const again = r.tries > 0
  return [
    `<div class="card" role="region" aria-label="Repair card">`,
    `<div class="big">${equationHTML(r.problem.text, '', r.problem.answer)}</div>`,
    `<div class="small">${esc(rep.small)}</div>`,
    `<div class="worked">${esc(rep.worked)}</div>`,
    `<div class="clause">${esc(rep.clause)}</div>`,
    `</div>`,
    `<button class="cell key continue" data-continue data-tap aria-label="Try again">${again ? 'Try again' : 'Try again'}</button>`,
  ].join('')
}

function trivia(state) {
  const t = state.trivia
  if (!t) return floorMode(state)
  const done = t.result !== null
  return [
    `<div class="tq">${esc(t.fact.q)}</div>`,
    ...t.choices.map((c, i) => {
      const cls = ['cell', 'choice', done && i === t.answer ? 'right' : '', done && i === t.chosen && i !== t.answer ? 'chosen' : ''].filter(Boolean).join(' ')
      return `<button class="${cls}" data-choice="${i}" data-tap ${done ? 'disabled' : ''} aria-label="${esc(c)}">${esc(c)}</button>`
    }),
  ].join('')
}

// ---- display band ------------------------------------------------------------------------
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
      case 'floor': set(`Press ${esc(label(r ? r.target : 1))}`, 'text', state.message); break
      case 'keypad': set(equationHTML(r.problem.text, r.typed), '', state.message); break
      case 'moving': set(r && r.problem ? equationHTML(r.problem.text, '', r.problem.answer) + '<span class="tick"> ✓</span>' : 'Going up', r && r.problem ? '' : 'text', ''); break
      case 'falling': set(r && r.problem ? equationHTML(r.problem.text, '', r.problem.answer) : '', '', ''); break
      case 'pit': case 'repair': set('Safety brake on.', 'text small', ''); break
      case 'trivia': case 'fact': set('A passenger asks:', 'text small', ''); break
      case 'descending': set('Going down', 'text', ''); break
      case 'roof': set('Roof', 'text', ''); break
      default: set('', 'text', '')
    }
  }
  return { render, fit: () => fit(questionEl) }
}
