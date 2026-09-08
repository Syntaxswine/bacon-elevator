// Screen markup: lobby, picker, rules, roof, fact book, workshop, grown-ups, and the fact sheet.
import { LEVELS, customLevel } from '../levels.js'
import { PARTS, PLAQUES, lunchboxMilestone } from '../state.js'
import { domainOf } from '../trivia.js'
import { encodeCode } from '../save.js'

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const BACON = (cls = 'bacon-icon') => `<svg class="${cls}" viewBox="0 0 64 32" aria-hidden="true"><use href="#bacon"/></svg>`
const LUNCH = `<svg class="lunch-icon" viewBox="0 0 24 20" aria-hidden="true"><rect x="1.5" y="6" width="21" height="12.5" rx="2" fill="#4A7BAA" stroke="#35618A" stroke-width="2"/><rect x="7" y="2" width="10" height="5" rx="1.5" fill="#35618A"/><rect x="1.5" y="10" width="21" height="2" fill="#35618A"/></svg>`

export function stepbar(step, id) {
  return `<span class="stepbar" ${id ? `id="${id}"` : ''} data-step="${step}" aria-label="step ${step} of 3"><i></i><i></i><i></i></span>`
}

function silhouette(id) {
  const shapes = {
    corner: '<rect x="6" y="30" width="36" height="24" fill="#B9B3A4" stroke="#6B6B6B" stroke-width="3"/><rect x="10" y="22" width="28" height="8" fill="#C9694A" stroke="#6B6B6B" stroke-width="3"/>',
    hotel: '<rect x="8" y="14" width="32" height="40" fill="#B9B3A4" stroke="#6B6B6B" stroke-width="3"/><rect x="16" y="6" width="16" height="8" fill="#B9B3A4" stroke="#6B6B6B" stroke-width="3"/>',
    office: '<rect x="6" y="6" width="36" height="48" fill="#B9B3A4" stroke="#6B6B6B" stroke-width="3"/><path d="M12 14h24M12 22h24M12 30h24M12 38h24" stroke="#6B6B6B" stroke-width="2"/>',
    sky: '<rect x="12" y="2" width="24" height="52" fill="#B9B3A4" stroke="#6B6B6B" stroke-width="3"/><rect x="20" y="0" width="8" height="4" fill="#6B6B6B"/>',
    megatall: '<path d="M18 54 V10 L24 2 L30 10 V54 Z" fill="#B9B3A4" stroke="#6B6B6B" stroke-width="3"/><rect x="8" y="34" width="10" height="20" fill="#B9B3A4" stroke="#6B6B6B" stroke-width="3"/><rect x="30" y="28" width="10" height="26" fill="#B9B3A4" stroke="#6B6B6B" stroke-width="3"/>',
    custom: '<rect x="6" y="20" width="36" height="34" fill="#E8D8A8" stroke="#6B6B6B" stroke-width="3" stroke-dasharray="4 3"/>',
  }
  return `<svg viewBox="0 0 48 56" aria-hidden="true">${shapes[id] || shapes.corner}</svg>`
}

// The floor as the child reads it, in one place: the lobby's parked-building line and the picker's
// note about what changing building does must not drift apart.
const floorLabel = (f) => (f === -1 ? 'P' : f === 0 ? 'G' : f === 10 ? 'R' : String(f))

function levelName(state) {
  // Ask the one function rather than composing the tag a second time from the raw knobs: the chip
  // and the picker must not keep telling the parent the lie that levels.js has stopped telling.
  if (state.level === 'custom') { const c = customLevel(state.settings.custom); return { name: c.name, tag: c.tag } }
  const l = LEVELS.find((x) => x.id === state.level) || LEVELS[0]
  return { name: l.name, tag: l.tag }
}

// Two notices a grown-up needs and a child never sees the cause of.
function noticeHTML(extras = {}) {
  const out = []
  if (extras.storageFailed) out.push('<p class="muted small" id="storagemsg">This browser is not keeping the score. Bacon will be here until the tab closes, then it starts again. Grown-ups &rarr; Save code copies it out.</p>')
  if (extras.adopted) out.push('<p class="muted small" id="adoptedmsg">Another tab of the game had newer bacon, so this one caught up with it.</p>')
  return out.join('')
}

export function lobby(state, extras = {}) {
  const { name, tag } = levelName(state)
  const rideLabel = state.ride ? 'Ride' : 'Ride'
  const plaques = state.plaques.length ? `<div class="plaques" aria-label="plaques">${state.plaques.map((p) => `<span class="plaque">${esc(p)} bacon</span>`).join('')}</div>` : ''
  return `<div class="page">
    <div class="lobby-head">
      <svg class="title-art" viewBox="0 0 220 120" aria-hidden="true">
        <rect x="70" y="8" width="80" height="104" rx="6" fill="#E9E4D8" stroke="#6B6B6B" stroke-width="4"/>
        <rect x="80" y="16" width="60" height="16" rx="3" fill="#2B2B2B"/><text x="110" y="29" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="700" font-size="13" fill="#E8B04A">G ▲</text>
        <rect x="84" y="40" width="26" height="64" fill="#D9D4C7" stroke="#6B6B6B" stroke-width="3"/><rect x="110" y="40" width="26" height="64" fill="#D9D4C7" stroke="#6B6B6B" stroke-width="3"/>
        <line x1="104" y1="64" x2="104" y2="80" stroke="#6B6B6B" stroke-width="3" stroke-linecap="round"/><line x1="116" y1="64" x2="116" y2="80" stroke="#6B6B6B" stroke-width="3" stroke-linecap="round"/>
        <use href="#bacon" x="6" y="30" width="60" height="30"/><use href="#bacon" x="154" y="30" width="60" height="30"/>
        <use href="#bacon" x="10" y="70" width="52" height="26"/><use href="#bacon" x="158" y="70" width="52" height="26"/>
      </svg>
      <h1>Bacon Elevator</h1>
      <div class="total" aria-label="lunchbox total">${LUNCH} <span id="lunchbox-total">${state.lunchbox}</span> ${BACON()}</div>
      ${state.ride ? `<p class="muted small">A building is waiting at floor ${esc(floorLabel(state.ride.floor))} with ${state.ride.tray} bacon on the tray.</p>` : ''}
    </div>
    <div class="stack">
      <button class="btn primary tall wide" data-nav="ride" data-tap aria-label="Ride">${rideLabel}</button>
      <button class="btn wide level" data-nav="picker" data-tap aria-label="Level: ${esc(name)}, ${esc(tag)}">${silhouette(state.level)}<span><span class="name">${esc(name)}</span><br><span class="tag">${esc(tag)}</span></span><span style="margin-left:auto">${stepbar(state.step)}</span></button>
      <div class="row">
        <button class="btn" style="flex:1" data-nav="factbook" data-tap aria-label="Fact Book">Fact Book</button>
        <button class="btn" style="flex:1" data-nav="workshop" data-tap aria-label="Workshop">Workshop</button>
      </div>
      <!-- The rules card showed once, on the first ride, and after that the only way back to it was
           an unlabelled bell on the panel, in floor mode, with the car standing still. A child who
           re-checks the rules — and a grown-up handing the phone over — needs something on the home
           screen that says what this is. -->
      <button class="btn wide" data-nav="rules" data-tap aria-label="How it works">How it works</button>
      <div class="row spread">
        <button class="btn ${state.settings.sound ? 'on' : ''}" data-sound data-tap aria-pressed="${state.settings.sound ? 'true' : 'false'}" aria-label="Sound ${state.settings.sound ? 'on' : 'off'}">♪ Sound ${state.settings.sound ? 'on' : 'off'}</button>
        <button class="btn quiet" data-gear data-nav="grownups" data-tap aria-label="Grown-ups: tap twice">⚙ Grown-ups</button>
      </div>
      ${plaques}
    </div>
    ${noticeHTML(extras)}
  </div>`
}

export function picker(state) {
  return `<div class="page">
    <div class="row spread"><h1>Pick a building</h1><button class="btn" data-nav="lobby" data-tap aria-label="Back to lobby">Lobby</button></div>
    ${state.ride ? `<p class="muted small">The building waiting at floor ${esc(floorLabel(state.ride.floor))} is finished when you pick another one: its ${state.ride.tray} bacon go into the lunchbox and the next Ride starts a new building at G.</p>` : ''}
    <p class="muted small">The tag says how big the numbers are. The bar is the step inside the building.</p>
    <div class="level-list">
      ${LEVELS.map((l) => `<button class="btn level ${state.level === l.id ? 'current' : ''}" data-level="${l.id}" data-tap aria-label="${esc(l.name)}, ${esc(l.tag)}">${silhouette(l.id)}<span><span class="name">${esc(l.name)}</span><br><span class="tag">${esc(l.tag)}</span></span><span style="margin-left:auto">${stepbar(state.level === l.id ? state.step : (state.adaptive ? 1 : state.pinnedStep))}</span></button>`).join('')}
    </div>
    <p class="muted small">Custom numbers live in Grown-ups.</p>
  </div>`
}

const PIC = {
  press: `<svg viewBox="0 0 120 84"><circle cx="60" cy="42" r="26" fill="#FFF0CC" stroke="#9A7A2A" stroke-width="4"/><text x="60" y="52" text-anchor="middle" font-size="28" font-weight="700" fill="#2B2B2B" font-family="system-ui">3</text></svg>`,
  solve: `<svg viewBox="0 0 120 84"><text x="60" y="38" text-anchor="middle" font-size="24" font-weight="700" fill="#2B2B2B" font-family="ui-monospace, monospace">7 <tspan fill="#2F7A8C">+</tspan> 5 = <tspan fill="#4A7BAA">12</tspan></text><text x="60" y="70" text-anchor="middle" font-size="21" font-weight="700" fill="#2B2B2B" font-family="ui-monospace, monospace">6 <tspan fill="#2F7A8C">▲</tspan> 4 = <tspan fill="#4A7BAA">10</tspan></text></svg>`,
  up: `<svg viewBox="0 0 120 84"><rect x="40" y="26" width="40" height="46" rx="3" fill="#E9E4D8" stroke="#6B6B6B" stroke-width="3"/><path d="M60 6 l12 14 h-8 v6 h-8 v-6 h-8 z" fill="#6E9B6E" stroke="#4E7B4E" stroke-width="2"/><use href="#bacon" x="84" y="40" width="32" height="16"/></svg>`,
  fall: `<svg viewBox="0 0 120 84"><rect x="22" y="8" width="36" height="40" rx="3" fill="#E9E4D8" stroke="#6B6B6B" stroke-width="3"/><path d="M40 52 l-8 -10 h16 z" fill="#5B6B7A"/><path d="M26 78 l6 -14 l6 14 M38 78 l6 -14 l6 14 M50 78 l6 -14 l6 14" fill="#9A9A9A" stroke="#6B6B6B" stroke-width="2" stroke-linejoin="round"/><path d="M84 70 V20" stroke="#6E9B6E" stroke-width="5" stroke-linecap="round"/><path d="M72 32 l12 -14 l12 14" fill="none" stroke="#6E9B6E" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // A faceless passenger inside the car, and the question mark that tags their floors.
  passenger: `<svg viewBox="0 0 120 84"><rect x="30" y="6" width="56" height="72" rx="3" fill="#E9E4D8" stroke="#6B6B6B" stroke-width="3"/><rect x="40" y="11" width="36" height="9" rx="2" fill="#2B2B2B"/><rect x="42" y="26" width="32" height="48" fill="#F8F5EE" stroke="#6B6B6B" stroke-width="2"/><circle cx="58" cy="41" r="7" fill="#8A8578"/><path d="M47 74 v-18 a11 11 0 0 1 22 0 v18 z" fill="#8A8578"/><circle cx="102" cy="42" r="14" fill="#4A7BAA"/><text x="102" y="50" text-anchor="middle" font-size="22" font-weight="800" fill="#fff" font-family="system-ui">?</text></svg>`,
}

export function rules(state) {
  const from = state.ride && state.screen === 'rules' ? 'Ride' : 'Ride'
  return `<div class="sheet rules" role="dialog" aria-label="Rules">
    <div class="body">
      <h1>How it works</h1>
      <div class="pics">
        <div class="pic">${PIC.press}Press the lit button</div>
        <div class="pic">${PIC.solve}Work out the sum. ▲ = up, ▼ = down</div>
        <div class="pic">${PIC.up}Right: up one floor, bacon on the tray</div>
        <div class="pic">${PIC.fall}Wrong: a fall, then back up</div>
        <div class="pic wide">${PIC.passenger}<span>A passenger may ask a question. <strong>A passenger's question never falls.</strong></span></div>
      </div>
      <p class="detail">Right: the doors close, the elevator goes up one floor, one ding, the bacon slides in.</p>
      <p>Wrong: the panel shows the true sum, then the elevator falls onto the springy spikes. The safety brake catches it. A repair card shows the sum, and you answer it again.</p>
      <p class="never">Bacon rides on the tray and goes into the lunchbox at the roof. <strong>Bacon is never lost. There is no clock.</strong></p>
    </div>
    <div class="foot"><button class="btn primary wide" data-continue data-tap aria-label="${from}">${from}</button></div>
  </div>`
}

export function roof(state) {
  const r = state.ride || { tray: 0 }
  const info = state.roof || { gained: 0, bonus: 0, unlocked: [], plaques: [], offer: null, lunchboxBefore: state.lunchbox }
  const next = lunchboxMilestone(state.lunchbox)
  const unlockedNames = info.unlocked.map((id) => (PARTS.find((p) => p.id === id) || {}).name).filter(Boolean)
  const offerName = info.offer ? (LEVELS.find((l) => l.id === info.offer) || {}).name : null
  const taken = info.offerTaken ? (LEVELS.find((l) => l.id === info.offerTaken) || {}).name : null
  // Six strips drift up for 2 s inside the picnic band only (never across the text or the buttons); none under reduced motion.
  const drift = Array.from({ length: 6 }, (_, i) => `<svg viewBox="0 0 64 32" style="left:${6 + i * 15}%;bottom:${6 + (i % 3) * 10}%;animation-delay:${i * 120}ms"><use href="#bacon"/></svg>`).join('')
  return `<div class="page">
    <h1>Roof picnic</h1>
    <div class="picnic-wrap">
      <svg class="picnic" viewBox="0 0 300 120" aria-hidden="true">
        <rect x="0" y="96" width="300" height="24" fill="#B9B3A4"/>
        <rect x="20" y="70" width="260" height="30" fill="#E9DFC8" stroke="#6B6B6B" stroke-width="3"/>
        ${Array.from({ length: 13 }, (_, i) => `<rect x="${20 + i * 20}" y="${70 + (i % 2) * 15}" width="20" height="15" fill="#C9694A" opacity="0.3"/>`).join('')}
        <rect x="110" y="30" width="80" height="44" rx="6" fill="#4A7BAA" stroke="#35618A" stroke-width="3"/><rect x="130" y="20" width="40" height="12" rx="4" fill="#35618A"/><rect x="110" y="48" width="80" height="4" fill="#35618A"/>
        <use href="#bacon" x="40" y="40" width="56" height="28"/><use href="#bacon" x="204" y="40" width="56" height="28"/>
      </svg>
      <div class="drift" aria-hidden="true">${drift}</div>
    </div>
    ${info.gained === null ? '' : `<p class="gain">Tray ${info.gained} → lunchbox</p>
    <p class="gain">+${info.bonus} roof bonus</p>`}
    <p class="total">${LUNCH} <span id="lunchbox-roof">${state.lunchbox}</span> ${BACON()}</p>
    ${unlockedNames.length ? `<p><strong>New in the Workshop:</strong> ${esc(unlockedNames.join(', '))}</p>` : next ? `<p class="muted">Next part at ${next.at} bacon: ${esc(next.part.name)}</p>` : ''}
    ${info.plaques.length ? `<p><strong>A plaque for ${esc(info.plaques.join(' and '))} bacon hangs in the Lobby.</strong></p>` : ''}
    ${taken ? `<p><strong>Next building: ${esc(taken)}.</strong></p>` : ''}
    ${offerName ? `<div class="row" style="justify-content:center"><span>Try ${esc(offerName)}?</span><button class="btn" data-offer="yes" data-tap aria-label="Yes, try ${esc(offerName)}">Yes</button><button class="btn primary" data-offer="stay" data-tap aria-label="Stay">Stay</button></div>` : ''}
    <div class="stack" style="width:100%;max-width:360px;margin-top:12px">
      <button class="btn primary tall wide" data-next data-tap aria-label="Next building">Next building</button>
      <button class="btn wide" data-nav="lobby" data-tap aria-label="Lobby, ride down">Lobby</button>
    </div>
  </div>`
}

export function factbook(state) {
  const byId = new Map(state.pool.map((f) => [f.id, f]))
  const ids = [...new Set(state.facts.seen)].reverse()
  const items = ids.map((id) => byId.get(id)).filter(Boolean)
  const links = state.settings.links
  return `<div class="page">
    <div class="row spread"><h1>Fact Book</h1><button class="btn" data-nav="lobby" data-tap aria-label="Back to lobby">Lobby</button></div>
    <p class="muted small">${items.length ? `${items.length} fact${items.length === 1 ? '' : 's'} heard from passengers. ${state.facts.right.length} answered right.` : 'Passengers step in on the ? floors. Every fact they tell you is written here.'}</p>
    ${items.map((f) => `<div class="book-item">
      <p class="q">${esc(f.q)}</p>
      <p><strong>Answer:</strong> ${esc(f.answer)}${state.facts.right.includes(f.id) ? ' <span class="muted small">(you got it)</span>' : ''}</p>
      <p>${esc(f.fact)}</p>
      ${f.sources.map((s) => `<p class="src">Source: ${links ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>` : esc(s.title)} (${esc(domainOf(s.url))})</p>`).join('')}
    </div>`).join('')}
  </div>`
}

export function workshop(state) {
  const slots = [['doors', 'Doors'], ['indicator', 'Indicator'], ['chime', 'Chime']]
  return `<div class="page">
    <div class="row spread"><h1>Workshop</h1><button class="btn" data-nav="lobby" data-tap aria-label="Back to lobby">Lobby</button></div>
    <p class="muted small">Real elevator parts. Bacon in the lunchbox unlocks them. Lunchbox: ${state.lunchbox}.</p>
    ${slots.map(([slot, title]) => `<h2>${title}</h2><div class="radio-row" role="radiogroup" aria-label="${title}">
      ${PARTS.filter((p) => p.slot === slot).map((p) => {
        const unlocked = p.at === 0 || state.unlocks.includes(p.id)
        const checked = state.equipped[slot] === p.id
        return `<button class="radio ${unlocked ? '' : 'locked'}" role="radio" aria-checked="${checked ? 'true' : 'false'}" data-equip-slot="${slot}" data-equip-part="${p.id}" data-tap ${unlocked ? '' : 'disabled'} aria-label="${esc(p.name)}${unlocked ? '' : `, unlocks at ${p.at} bacon`}">${esc(p.name)}${unlocked ? '' : `<br><small>at ${p.at} bacon</small>`}</button>`
      }).join('')}
    </div>`).join('')}
    <h2>Plaques</h2>
    <div class="plaques">${PLAQUES.map((p) => state.plaques.includes(String(p)) ? `<span class="plaque">${p} bacon</span>` : `<span class="plaque" style="opacity:.4">${p}</span>`).join('')}</div>
    <p class="muted small">More parts (half-moon dial, nixie tubes, wood and brass cars) are on the v2 ladder.</p>
  </div>`
}

function toggle(key, label, on, note) {
  return `<div class="setting"><span class="label">${esc(label)}${note ? `<small>${esc(note)}</small>` : ''}</span><button class="btn ${on ? 'on' : ''}" data-setting="${key}" data-value="${on ? 'false' : 'true'}" data-tap role="switch" aria-checked="${on ? 'true' : 'false'}" aria-label="${esc(label)}">${on ? 'On' : 'Off'}</button></div>`
}
function radios(key, label, opts, cur) {
  return `<div class="setting"><span class="label">${esc(label)}</span><span class="radio-row" role="radiogroup" aria-label="${esc(label)}">${opts.map(([v, t]) => `<button class="radio" role="radio" aria-checked="${cur === v ? 'true' : 'false'}" data-setting="${key}" data-value="${v}" data-tap aria-label="${esc(t)}">${esc(t)}</button>`).join('')}</span></div>`
}
function stepper(key, label, val, delta, note) {
  return `<div class="setting"><span class="label">${esc(label)}${note ? `<small>${esc(note)}</small>` : ''}</span><span class="stepper"><button class="btn" data-setting="${key}" data-value="${val - delta}" data-tap aria-label="${esc(label)} down">−</button><span class="val" aria-live="polite">${val}</span><button class="btn" data-setting="${key}" data-value="${val + delta}" data-tap aria-label="${esc(label)} up">+</button></span></div>`
}

export function grownups(state, extras = {}) {
  const s = state.settings
  const c = s.custom
  const ops = [['add', '+'], ['sub', '−'], ['mul', '×'], ['div', '÷'], ['missAdd', 'a + ▮'], ['up', '▲'], ['down', '▼']]
  const resetLabel = extras.resetArmed ? 'Tap again to reset everything' : 'Reset everything'
  return `<div class="page">
    <div class="row spread"><h1>Grown-ups</h1><button class="btn" data-nav="lobby" data-tap aria-label="Back to lobby">Lobby</button></div>
    <h2>Sound</h2>
    ${toggle('sound', 'Sound', s.sound, 'Off by default. Only elevator sounds; no music, no voices.')}
    ${stepper('volume', 'Volume', s.volume, 10)}
    <h2>Elevator</h2>
    ${radios('speed', 'Speed', [['normal', 'Normal'], ['fast', 'Fast']], s.speed)}
    ${radios('motion', 'Motion', [['auto', 'Auto'], ['full', 'Full'], ['reduced', 'Reduced']], s.motion)}
    ${radios('passengers', 'Passengers', [['often', 'Often'], ['sometimes', 'Sometimes'], ['never', 'Never']], s.passengers)}
    <h2>Maths</h2>
    ${toggle('secondTry', 'Second try', s.secondTry, 'The first wrong answer clears the entry; only the second falls.')}
    ${toggle('adaptive', 'Adaptive step', state.adaptive, 'Three right in a row: step up. A fall: step down, once per building. The elevator says so in words: "Bigger numbers now."')}
    ${state.adaptive ? '' : stepper('pinnedStep', 'Pinned step', state.pinnedStep, 1)}
    <h2>Level</h2>
    <div class="radio-row" role="radiogroup" aria-label="Level">
      ${[...LEVELS.map((l) => [l.id, `${l.name} — ${l.tag}`]), ['custom', 'Custom']].map(([id, name]) => `<button class="radio" role="radio" aria-checked="${state.level === id ? 'true' : 'false'}" data-level="${id}" data-tap aria-label="${esc(name)}">${esc(name)}</button>`).join('')}
    </div>
    <h2>Custom numbers</h2>
    <div class="setting"><span class="label">Operations</span><span class="radio-row">${ops.map(([id, t]) => `<button class="radio" role="checkbox" aria-checked="${c.ops.includes(id) ? 'true' : 'false'}" data-custom-op="${id}" data-tap aria-label="${esc(t)}">${esc(t)}</button>`).join('')}</span></div>
    ${stepper('custom.min', 'Smallest number', c.min, 5)}
    ${stepper('custom.max', 'Largest number', c.max, 5)}
    ${toggle('custom.negatives', 'Negative answers', c.negatives)}
    <h2>Reading</h2>
    ${toggle('bigText', 'Bigger text', s.bigText)}
    ${toggle('links', 'Open source links', s.links, 'Off: sources are plain text. On: the Fact Book links to them.')}
    ${noticeHTML(extras)}
    <h2>Save code</h2>
    <p class="muted small">Copy this code to move your lunchbox to another phone. iOS may clear a web game's storage after 7 days if it is not added to the Home Screen.</p>
    <div class="code" id="savecode">${esc(encodeCode(state))}</div>
    <div class="row wrap" style="margin-top:8px">
      <button class="btn" data-copy data-tap aria-label="Copy save code">Copy code</button>
      <button class="btn" data-paste data-tap aria-label="Paste save code">Paste code</button>
      <span class="muted small" id="codemsg" aria-live="polite">${esc(extras.codeMsg || '')}</span>
    </div>
    <h2>Reset</h2>
    <p class="muted small">Two taps, five seconds apart. Everything goes back to the start.</p>
    <button class="btn" data-reset data-tap aria-label="${resetLabel}">${resetLabel}</button>
    <p class="muted small" id="resetmsg" aria-live="polite">${esc(extras.resetMsg || '')}</p>
    <p class="muted small" style="margin-top:20px">Version ${esc(extras.version || '')}</p>
  </div>`
}

export function factSheet(state) {
  const t = state.trivia
  if (!t) return ''
  const right = t.result === 'right'
  const chosen = t.chosen === null ? '' : t.choices[t.chosen]
  return `<div class="sheet fact" role="dialog" aria-label="Fact card">
    <div class="body">
      <p class="q">${esc(t.fact.q)}</p>
      <p class="verdict ${right ? 'right' : ''}">You chose ${esc(chosen)}.${right ? ' +2 bacon' : ''}</p>
      ${right ? '' : `<p class="verdict">The answer is ${esc(t.fact.answer)}.</p>`}
      <p class="factline">${esc(t.fact.fact)}</p>
      ${t.fact.sources.map((s) => `<p class="src">Source: ${esc(s.title)} (${esc(domainOf(s.url))})</p>`).join('')}
    </div>
    <div class="foot"><button class="btn primary wide" data-continue data-tap aria-label="Got it">Got it</button></div>
  </div>`
}
