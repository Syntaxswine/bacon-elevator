// Screen markup: lobby, picker, rules, roof, fact book, workshop, grown-ups, and the fact sheet.
import { LEVELS, customLevel } from '../levels.js'
import { PARTS, PLAQUES, currentLevel, lunchboxMilestone } from '../state.js'
import { SLOTS, partsBySlot, partById, nextPart, isUnlocked, partsOwned } from '../parts.js'
import { climbGoal, climbLabel } from '../climb.js'
import { domainOf, letterFor } from '../trivia.js'
import { encodeCode } from '../save.js'

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const BACON = (cls = 'bacon-icon') => `<svg class="${cls}" viewBox="0 0 64 32" aria-hidden="true"><use href="#bacon"/></svg>`
const LUNCH = `<svg class="lunch-icon" viewBox="0 0 24 20" aria-hidden="true"><rect x="1.5" y="6" width="21" height="12.5" rx="2" fill="#4A7BAA" stroke="#35618A" stroke-width="2"/><rect x="7" y="2" width="10" height="5" rx="1.5" fill="#35618A"/><rect x="1.5" y="10" width="21" height="2" fill="#35618A"/></svg>`


// ---- part drawings -------------------------------------------------------------------------
// Every part is drawn here, in inline SVG, at one size and scaled by the box it is put in — the
// Workshop row, the part card, and the roof card all show the SAME picture, so "the thing that
// arrived" and "the thing in the Workshop" are recognisably one object. 64 x 40 world units, flat
// and thick-outlined like everything else in the game. Nothing here animates.
const ART_BOX = 'viewBox="0 0 64 40"'
const DOORWAY = '<rect x="2" y="2" width="60" height="36" rx="2" fill="#F8F5EE" stroke="#6B6B6B" stroke-width="2.5"/>'
const BEZEL = '<rect x="2" y="6" width="60" height="28" rx="3" fill="#2B2B2B"/>'
const leafArt = (x, w, cls = '#D9D4C7') => `<rect x="${x}" y="4" width="${w}" height="32" fill="${cls}" stroke="#6B6B6B" stroke-width="2"/>`

const PART_ART = {
  'doors-centre': DOORWAY + leafArt(4, 28) + leafArt(32, 28) + '<line x1="26" y1="14" x2="26" y2="26" stroke="#6B6B6B" stroke-width="2.5" stroke-linecap="round"/><line x1="38" y1="14" x2="38" y2="26" stroke="#6B6B6B" stroke-width="2.5" stroke-linecap="round"/>',
  // the wide slow leaf and the narrow fast one, meeting well off centre — recognisable shut
  'doors-telescopic': DOORWAY + leafArt(4, 38) + leafArt(42, 18) + '<line x1="38" y1="14" x2="38" y2="26" stroke="#6B6B6B" stroke-width="2.5" stroke-linecap="round"/><path d="M46 20 h10 M52 16 l4 4 l-4 4" fill="none" stroke="#6B6B6B" stroke-width="2"/>',
  'doors-single': DOORWAY + leafArt(4, 56) + '<line x1="54" y1="14" x2="54" y2="26" stroke="#6B6B6B" stroke-width="2.5" stroke-linecap="round"/>',
  'doors-gate': DOORWAY + Array.from({ length: 5 }, (_, i) => {
    const x = 4 + i * 11.2
    return `<line x1="${x}" y1="5" x2="${x + 11.2}" y2="35" stroke="#8A8578" stroke-width="2.5" stroke-linecap="round"/><line x1="${x + 11.2}" y1="5" x2="${x}" y2="35" stroke="#8A8578" stroke-width="2.5" stroke-linecap="round"/><line x1="${x}" y1="4" x2="${x}" y2="36" stroke="#6B6B6B" stroke-width="1.8"/>`
  }).join('') + '<rect x="56" y="4" width="4" height="32" fill="#8A8578" stroke="#6B6B6B" stroke-width="1.8"/>',
  'doors-four': DOORWAY + leafArt(4, 14) + leafArt(18, 14) + leafArt(32, 14) + leafArt(46, 14) + '<line x1="30" y1="14" x2="30" y2="26" stroke="#6B6B6B" stroke-width="2.5" stroke-linecap="round"/><line x1="34" y1="14" x2="34" y2="26" stroke="#6B6B6B" stroke-width="2.5" stroke-linecap="round"/>',

  segment: BEZEL + '<g fill="none" stroke="#E8B04A" stroke-width="3" stroke-linecap="round"><path d="M22 12h10M22 12v8M32 12v8M22 20h10M22 20v8M32 20v8M22 28h10"/></g><path d="M44 26 l5-8 l5 8 z" fill="#E8B04A"/>',
  dotmatrix: BEZEL + (() => {
    const rows = ['01110', '10001', '10011', '10101', '11001', '10001', '01110']
    let out = ''
    rows.forEach((r, y) => { for (let x = 0; x < 5; x++) if (r[x] === '1') out += `<circle cx="${20 + x * 4}" cy="${11 + y * 3.2}" r="1.4" fill="#E8B04A"/>` })
    for (const [dx, dy] of [[0, 0], [-2, 2], [2, 2], [-4, 4], [4, 4]]) out += `<circle cx="${46 + dx}" cy="${16 + dy}" r="1.4" fill="#E8B04A"/>`
    return out
  })(),
  'ind-dial': '<rect x="2" y="6" width="60" height="28" rx="3" fill="#4A3A18"/>' + (() => {
    let out = `<path d="M14 28 A18 18 0 0 1 50 28" fill="none" stroke="#E8B04A" stroke-width="1.6"/>`
    for (let i = 0; i < 9; i++) {
      const a = Math.PI - (i / 8) * Math.PI
      out += `<line x1="${(32 + Math.cos(a) * 14).toFixed(1)}" y1="${(28 - Math.sin(a) * 14).toFixed(1)}" x2="${(32 + Math.cos(a) * 18).toFixed(1)}" y2="${(28 - Math.sin(a) * 18).toFixed(1)}" stroke="#E8B04A" stroke-width="1.4"/>`
    }
    return out + '<line x1="32" y1="28" x2="43" y2="16" stroke="#F4E3B8" stroke-width="2.6" stroke-linecap="round"/><circle cx="32" cy="28" r="2.6" fill="#E8B04A"/>'
  })(),
  'ind-numerals': BEZEL + ['G', '1', '2', '3', '4', '5', '6', '7'].map((ch, i) =>
    `<text x="${8 + i * 7}" y="24" font-family="ui-monospace, monospace" font-weight="700" font-size="${i === 3 ? 11 : 9}" fill="${i === 3 ? '#E8B04A' : '#A29C8E'}">${ch}</text>`).join(''),
  'ind-nixie': '<rect x="2" y="6" width="60" height="28" rx="3" fill="#1C1A16"/>' +
    [20, 44].map((cx, k) => `<rect x="${cx - 12}" y="9" width="24" height="22" rx="9" fill="#3A342A" stroke="#8A8578" stroke-width="1.2"/>` +
      [-2, -1, 0, 1, 2].map((i) => `<line x1="${cx + i * 4.5}" y1="10" x2="${cx + i * 4.5}" y2="30" stroke="#6B6B6B" stroke-width="0.6" opacity="0.7"/>`).join('') +
      `<text x="${cx}" y="27" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="700" font-size="20" fill="#FF8A2A" opacity="0.35">${k ? '\u25B2' : '4'}</text>` +
      `<text x="${cx}" y="26" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="700" font-size="16" fill="#FFB25A">${k ? '\u25B2' : '4'}</text>`).join(''),

  'cab-steel': cabArt('#E9E4D8', '#6B6B6B', '#F8F5EE', ''),
  'cab-stainless': cabArt('#CDD2D3', '#6E7476', '#E4E8E9', Array.from({ length: 13 }, (_, i) => `<line x1="${6 + i * 4}" y1="5" x2="${6 + i * 4}" y2="35" stroke="#B9C0C2" stroke-width="1"/>`).join('')),
  'cab-veneer': cabArt('#B98A5A', '#6B4A2A', '#D9B489', '<line x1="20" y1="5" x2="20" y2="35" stroke="#6B4A2A" stroke-width="1.6"/><line x1="44" y1="5" x2="44" y2="35" stroke="#6B4A2A" stroke-width="1.6"/><line x1="4" y1="13" x2="60" y2="13" stroke="#6B4A2A" stroke-width="1.6"/><rect x="8" y="26" width="48" height="3" rx="1.5" fill="#CDD2D3" stroke="#6E7476" stroke-width="1"/>'),
  'cab-brass': cabArt('#C9A227', '#8A6A12', '#E6C766', '<line x1="22" y1="5" x2="22" y2="35" stroke="#8A6A12" stroke-width="1.6"/><line x1="42" y1="5" x2="42" y2="35" stroke="#8A6A12" stroke-width="1.6"/><rect x="4" y="7" width="56" height="4" fill="#F0DC9A" opacity="0.85"/>'),
  'cab-glass': '<rect x="2" y="2" width="60" height="36" rx="2" fill="#CFE0E6" fill-opacity="0.34" stroke="#5A7A86" stroke-width="2.5"/><line x1="18" y1="3" x2="18" y2="37" stroke="#5A7A86" stroke-width="1.4"/><line x1="46" y1="3" x2="46" y2="37" stroke="#5A7A86" stroke-width="1.4"/><rect x="2" y="2" width="4" height="36" fill="#5A7A86" opacity="0.6"/><rect x="58" y="2" width="4" height="36" fill="#5A7A86" opacity="0.6"/><path d="M8 32 h48" stroke="#8A8578" stroke-width="1.6"/><circle cx="32" cy="20" r="5" fill="none" stroke="#5A7A86" stroke-width="1.4"/>',

  single: bellArt(1),
  'two-tone': bellArt(2),
  'chime-gong': '<circle cx="26" cy="20" r="14" fill="#C9A227" stroke="#8A6A12" stroke-width="2.5"/><circle cx="26" cy="20" r="7" fill="none" stroke="#8A6A12" stroke-width="1.6"/><rect x="42" y="17" width="14" height="6" rx="3" fill="#7A7568" stroke="#55534E" stroke-width="1.6"/><path d="M44 12 l-4 -5 M46 28 l-4 5" stroke="#8A6A12" stroke-width="1.6" stroke-linecap="round"/>',

  'edge-safety': DOORWAY + leafArt(4, 26) + '<rect x="30" y="4" width="4" height="32" rx="2" fill="#8A8578" stroke="#55534E" stroke-width="1.5"/><path d="M42 20 h12 M48 15 l-6 5 l6 5" fill="none" stroke="#6B6B6B" stroke-width="2" stroke-linecap="round"/>',
  'edge-curtain': DOORWAY + leafArt(4, 22) + '<rect x="26" y="4" width="4" height="32" rx="2" fill="#4A4741"/><circle cx="28" cy="10" r="2.2" fill="#C05A2E"/><circle cx="28" cy="30" r="2.2" fill="#C05A2E"/>' +
    [10, 20, 30].map((y) => Array.from({ length: 5 }, (_, i) => `<circle cx="${34 + i * 5.5}" cy="${y}" r="1.3" fill="#E8B04A"/>`).join('')).join(''),

  'guides-shoe': '<rect x="28" y="2" width="8" height="36" fill="#9A958A"/><rect x="18" y="12" width="12" height="16" rx="2" fill="#7A7568" stroke="#55534E" stroke-width="2"/><rect x="34" y="12" width="12" height="16" rx="2" fill="#7A7568" stroke="#55534E" stroke-width="2"/>',
  'guides-roller': '<rect x="28" y="2" width="8" height="36" fill="#9A958A"/>' +
    [[22, 12], [22, 28], [16, 20]].map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="5" fill="#7A7568" stroke="#55534E" stroke-width="2"/>`).join('') +
    [[42, 12], [42, 28], [48, 20]].map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="5" fill="#7A7568" stroke="#55534E" stroke-width="2"/>`).join(''),

  'panel-plain': '<rect x="22" y="2" width="20" height="36" rx="3" fill="#CFC9BA" stroke="#6B6B6B" stroke-width="2"/>' +
    [8, 17, 26, 35].map((cy) => `<circle cx="32" cy="${cy - 2}" r="3.4" fill="#F8F5EE" stroke="#6B6B6B" stroke-width="1.4"/>`).join(''),
  // the raised number and its braille sit immediately to the LEFT of the button they belong to
  'panel-braille': '<rect x="14" y="2" width="34" height="36" rx="3" fill="#CFC9BA" stroke="#6B6B6B" stroke-width="2"/>' +
    [8, 17, 26, 35].map((cy, i) => `<circle cx="40" cy="${cy - 2}" r="3.4" fill="#F8F5EE" stroke="#6B6B6B" stroke-width="1.4"/>` +
      `<text x="26" y="${cy + 1}" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="700" font-size="7" fill="#2B2B2B">${4 - i}</text>` +
      [0, 1].map((c) => [0, 1, 2].map((r) => ((i + c + r) % 3 === 0 ? '' : `<circle cx="${18 + c * 3}" cy="${cy - 5 + r * 3}" r="1.1" fill="#55534E"/>`)).join('')).join('')).join(''),
}

function cabArt(body, line, inner, decor) {
  return `<rect x="2" y="2" width="60" height="36" rx="2" fill="${body}" stroke="${line}" stroke-width="2.5"/>${decor}<rect x="20" y="10" width="24" height="24" fill="${inner}" stroke="${line}" stroke-width="2"/>`
}
function bellArt(n) {
  const bell = '<path d="M20 26 a12 12 0 0 1 24 0 z" fill="#CFC9BA" stroke="#6B6B6B" stroke-width="2.5" stroke-linejoin="round"/><circle cx="32" cy="29" r="3" fill="#6B6B6B"/>'
  const waves = Array.from({ length: n }, (_, i) => `<path d="M${48 + i * 6} ${14 + i * 0} a8 8 0 0 1 0 12" fill="none" stroke="#6B6B6B" stroke-width="2" stroke-linecap="round"/>`).join('')
  return bell + waves
}

// The one place a part is drawn. `size` is a CSS class, never a pixel: the Workshop row, the card
// and the roof card give it different boxes and the same drawing fills each of them.
export function partArt(id, cls = 'part-art') {
  const art = PART_ART[id]
  if (!art) return ''
  return `<svg class="${cls}" ${ART_BOX} aria-hidden="true">${art}</svg>`
}

// ---- the forward lines ----------------------------------------------------------------------
// THE CHILD MUST ALWAYS SEE WHAT THE NEXT THING IS AND HOW FAR AWAY IT IS. Two ladders, and between
// them they can never both be silent: bacon (parts, then plaques, which ends at 5000) and floors
// (The Climb, which never ends). Both lines are built here so the roof, the lobby, the Workshop and
// the Logbook say the same words.
export function baconGoalLine(state) {
  const m = lunchboxMilestone(state.lunchbox)
  if (!m) return ''
  const left = m.at - state.lunchbox
  const what = m.part ? m.part.name : `a plaque for ${m.at} bacon`
  return `Next at ${m.at} bacon: ${what} — ${left} more.`
}
export function climbGoalLine(state) {
  const g = climbGoal(state.records ? state.records.floors : 0, state.climb || [])
  if (!g.next) return ''
  // `1 more floors` was printed to a child who counts, on the one line whose whole job is a number.
  return `The Climb: ${g.next.remaining} more ${g.next.remaining === 1 ? 'floor' : 'floors'} to ${climbLabel(g.next)} — ${g.next.floors} floors.`
}

// A LEVEL WITH ONE BAND HAS NO LADDER TO DRAW (r5-code-hostile-02). Custom is `steps: [{kinds}]`
// and stepOf() clamps, so steps 1, 2 and 3 are the same table object: measured over 2 000 draws,
// mean |answer| 10.39 at all three and the same 270 problem keys. The pips still moved 1 -> 2 -> 3
// and the chip still told a screen reader "step 2 of 3". Three pips and a count are a claim about
// the question set; where there is one set, neither is drawn.
export function stepbar(step, id, steps = 3) {
  if (steps <= 1) return ''
  return `<span class="stepbar" ${id ? `id="${id}"` : ''} data-step="${step}" aria-label="step ${step} of ${steps}"><i></i><i></i><i></i></span>`
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
  // A SAVE THAT WILL NOT PARSE USED TO RESET THE LUNCHBOX IN SILENCE (r4-autism-fit-5). migrate()
  // falls back to initialState() for unreadable JSON, so the game booted as a brand-new save with
  // no console error and nothing on any screen — while the neighbouring failure, a REFUSED write,
  // has explained itself since round 2. The unreadable text is kept aside under its own key so a
  // grown-up still has something to paste at Grown-ups → Save code.
  if (extras.saveUnreadable) out.push('<p class="muted small" id="saveerrmsg">The saved lunchbox could not be read, so this is a fresh start. A grown-ups save code, if you have one, can put it back.</p>')
  // The confirmation of a two-tap reset, which used to be written to the Grown-ups screen the same
  // dispatch navigated away from (r4-code-hostile-05).
  if (extras.lobbyMsg) out.push(`<p class="muted small" id="lobbymsg" aria-live="polite">${esc(extras.lobbyMsg)}</p>`)
  return out.join('')
}

export function lobby(state, extras = {}) {
  const { name, tag } = levelName(state)
  const plaques = state.plaques.length ? `<div class="plaques" aria-label="plaques">${state.plaques.map((p) => `<span class="plaque">${esc(p)} bacon</span>`).join('')}</div>` : ''
  return `<div class="page">
    <div class="lobby-head">
      <svg class="title-art" viewBox="0 0 220 120" aria-hidden="true">
        <rect x="70" y="8" width="80" height="104" rx="6" fill="#E9E4D8" stroke="#6B6B6B" stroke-width="4"/>
        <rect x="80" y="16" width="60" height="16" rx="3" fill="#2B2B2B"/>${/* No arrow on a parked car: the bezel reads the floor, and the doors below it are drawn open. A lit direction arrow belongs to a car answering a call, which is what the ride screen's own indicator draws (r5-elevator-feel-03). */''}<text x="110" y="29" text-anchor="middle" font-family="ui-monospace, monospace" font-weight="700" font-size="13" fill="#E8B04A">G</text>
        <rect x="84" y="40" width="26" height="64" fill="#D9D4C7" stroke="#6B6B6B" stroke-width="3"/><rect x="110" y="40" width="26" height="64" fill="#D9D4C7" stroke="#6B6B6B" stroke-width="3"/>
        <line x1="104" y1="64" x2="104" y2="80" stroke="#6B6B6B" stroke-width="3" stroke-linecap="round"/><line x1="116" y1="64" x2="116" y2="80" stroke="#6B6B6B" stroke-width="3" stroke-linecap="round"/>
        <use href="#bacon" x="6" y="30" width="60" height="30"/><use href="#bacon" x="154" y="30" width="60" height="30"/>
        <use href="#bacon" x="10" y="70" width="52" height="26"/><use href="#bacon" x="158" y="70" width="52" height="26"/>
      </svg>
      <h1>Bacon Elevator</h1>
      <div class="total" aria-label="lunchbox total">${LUNCH} <span id="lunchbox-total">${state.lunchbox}</span> ${BACON()}</div>
      ${/* The tray minus what it has already given the lunchbox: after a mid-building Lobby tap the
            old line counted the same bacon twice, once here and once in the total above it. */''}
      ${state.ride ? `<p class="muted small">A building is waiting at floor ${esc(floorLabel(state.ride.floor))} with ${Math.max(0, state.ride.tray - (state.ride.banked || 0))} bacon on the tray.</p>` : ''}

      ${noticeHTML(extras)}
    </div>
    <div class="stack">
      <button class="btn primary tall wide" data-nav="ride" data-tap aria-label="Ride">Ride</button>
      <button class="btn wide level" data-nav="picker" data-tap aria-label="Level: ${esc(name)}, ${esc(tag)}">${silhouette(state.level)}<span><span class="name">${esc(name)}</span><br><span class="tag">${esc(tag)}</span></span><span style="margin-left:auto">${stepbar(state.step, '', currentLevel(state).steps.length)}</span></button>
      <div class="row">
        <button class="btn" style="flex:1" data-nav="factbook" data-tap aria-label="Fact Book">Fact Book</button>
        <button class="btn" style="flex:1" data-nav="workshop" data-tap aria-label="Workshop">Workshop</button>
      </div>
      <div class="row">
        <button class="btn" style="flex:1" data-nav="logbook" data-tap aria-label="Logbook">Logbook</button>
        <button class="btn" style="flex:1" data-nav="rules" data-tap aria-label="How it works">How it works</button>
      </div>
      <!-- The rules card showed once, on the first ride, and after that the only way back to it was
           an unlabelled bell on the panel, in floor mode, with the car standing still. A child who
           re-checks the rules — and a grown-up handing the phone over — needs something on the home
           screen that says what this is. It shares its row with the Logbook rather than taking a
           band of its own: the lobby now has four places to go and one Ride button, and Ride must
           stay the tall one. -->
      <div class="row spread">
        ${/* LABEL, THEN STATE (r4-autism-fit-4). The visible text was the CURRENT state on a control
              shaped like a command, so a child reading `♪ Sound off` and tapping it got sound ON —
              the opposite of what the words said. Grown-ups has always used label + switch
              (`Sound` with an [Off] pill); the lobby now uses the same idiom, so the words name the
              thing and the pill names the state. */''}
        <button class="btn sound-btn ${state.settings.sound ? 'on' : ''}" data-sound data-tap role="switch" aria-checked="${state.settings.sound ? 'true' : 'false'}" aria-label="Sound">♪ Sound<span class="pill">${state.settings.sound ? 'On' : 'Off'}</span></button>
        <button class="btn quiet" data-gear data-nav="grownups" data-tap aria-label="Grown-ups: tap twice">⚙ Grown-ups</button>
      </div>
      ${/* WHAT THE NEXT THING IS AND HOW FAR AWAY IT IS — on the screen the child starts from, not
            only on the roof card they see once a building. Two ladders that between them can never
            both be silent: bacon (parts, then plaques) and floors ridden (The Climb).
            BELOW the buttons, not above them: at 568 x 276 two extra lines in the head pushed `Ride`
            to 36 px of its 72 on screen at rest, which is the r3-mobile-ux-3 defect with new words
            in it. A goal line that costs the child the Ride button is not a goal line. */''}
      <div class="goals">
        ${baconGoalLine(state) ? `<p class="goal small" data-goal="bacon">${esc(baconGoalLine(state))}</p>` : ''}
        ${climbGoalLine(state) ? `<p class="goal small" data-goal="climb">${esc(climbGoalLine(state))}</p>` : ''}
      </div>
      ${plaques}
    </div>
  </div>`
}

export function picker(state) {
  return `<div class="page">
    <div class="row spread"><h1>Pick a building</h1><button class="btn" data-nav="lobby" data-tap aria-label="Back to lobby">Lobby</button></div>
    ${state.ride ? `<p class="muted small">The building waiting at floor ${esc(floorLabel(state.ride.floor))} is finished when you pick another one: its ${Math.max(0, state.ride.tray - (state.ride.banked || 0))} bacon go into the lunchbox and the next Ride starts a new building at G.</p>` : ''}
    <p class="muted small">The tag says how big the numbers are. The bar is the step inside the building.</p>
    <div class="level-list">
      ${LEVELS.map((l) => `<button class="btn level ${state.level === l.id ? 'current' : ''}" data-level="${l.id}" data-tap aria-label="${esc(l.name)}, ${esc(l.tag)}">${silhouette(l.id)}<span><span class="name">${esc(l.name)}</span><br><span class="tag">${esc(l.tag)}</span></span><span style="margin-left:auto">${stepbar(state.level === l.id ? state.step : (state.adaptive ? 1 : state.pinnedStep))}</span></button>`).join('')}
    </div>
    <p class="muted small">Custom numbers live in Grown-ups.</p>
  </div>`
}

const PIC = {
  press: `<svg viewBox="0 0 120 84"><circle cx="60" cy="42" r="26" fill="#FFF0CC" stroke="#9A7A2A" stroke-width="4"/><text x="60" y="52" text-anchor="middle" font-size="28" font-weight="700" fill="#2B2B2B" font-family="system-ui">3</text></svg>`,
  // THREE WORKED EXAMPLES, because the game asks three shapes. The first two put the blank at the
  // end; `a + ▮ = c` moves it into the middle and arrives at Corner Shop step 3 — question 7 of a
  // fresh save — and the card said nothing about it at all (r4-math-03).
  solve: `<svg viewBox="0 0 120 84"><text x="60" y="26" text-anchor="middle" font-size="21" font-weight="700" fill="#2B2B2B" font-family="ui-monospace, monospace">7 <tspan fill="#2F7A8C">+</tspan> 5 = <tspan fill="#4A7BAA">12</tspan></text><text x="60" y="52" text-anchor="middle" font-size="19" font-weight="700" fill="#2B2B2B" font-family="ui-monospace, monospace">6 <tspan fill="#2F7A8C">▲</tspan> 4 = <tspan fill="#4A7BAA">10</tspan></text><text x="60" y="78" text-anchor="middle" font-size="19" font-weight="700" fill="#2B2B2B" font-family="ui-monospace, monospace">7 <tspan fill="#2F7A8C">+</tspan> <tspan fill="#4A7BAA">5</tspan> = 12</text></svg>`,
  up: `<svg viewBox="0 0 120 84"><rect x="40" y="26" width="40" height="46" rx="3" fill="#E9E4D8" stroke="#6B6B6B" stroke-width="3"/><path d="M60 6 l12 14 h-8 v6 h-8 v-6 h-8 z" fill="#6E9B6E" stroke="#4E7B4E" stroke-width="2"/><use href="#bacon" x="84" y="40" width="32" height="16"/></svg>`,
  fall: `<svg viewBox="0 0 120 84"><rect x="22" y="8" width="36" height="40" rx="3" fill="#E9E4D8" stroke="#6B6B6B" stroke-width="3"/><path d="M40 52 l-8 -10 h16 z" fill="#5B6B7A"/><path d="M26 78 l6 -14 l6 14 M38 78 l6 -14 l6 14 M50 78 l6 -14 l6 14" fill="#9A9A9A" stroke="#6B6B6B" stroke-width="2" stroke-linejoin="round"/><path d="M84 70 V20" stroke="#6E9B6E" stroke-width="5" stroke-linecap="round"/><path d="M72 32 l12 -14 l12 14" fill="none" stroke="#6E9B6E" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // A faceless passenger inside the car, and the question mark that tags their floors.
  passenger: `<svg viewBox="0 0 120 84"><rect x="30" y="6" width="56" height="72" rx="3" fill="#E9E4D8" stroke="#6B6B6B" stroke-width="3"/><rect x="40" y="11" width="36" height="9" rx="2" fill="#2B2B2B"/><rect x="42" y="26" width="32" height="48" fill="#F8F5EE" stroke="#6B6B6B" stroke-width="2"/><circle cx="58" cy="41" r="7" fill="#8A8578"/><path d="M47 74 v-18 a11 11 0 0 1 22 0 v18 z" fill="#8A8578"/><circle cx="102" cy="42" r="14" fill="#4A7BAA"/><text x="102" y="50" text-anchor="middle" font-size="22" font-weight="800" fill="#fff" font-family="system-ui">?</text></svg>`,
}

export function rules(state) {
  const second = !!state.settings.secondTry
  return `<div class="sheet rules" role="dialog" aria-label="Rules">
    <div class="body">
      <h1>How it works</h1>
      <div class="pics">
        <div class="pic">${PIC.press}Press the lit button</div>
        <div class="pic">${PIC.solve}Work out the sum. ▲ = add, ▼ = take away, ▮ = missing</div>
        <div class="pic">${PIC.up}Right: up one floor, bacon on the tray</div>
        <div class="pic">${PIC.fall}Wrong: ${second ? 'one more go, then a fall' : 'a fall, then back up'}</div>
        <div class="pic wide">${PIC.passenger}<span>A passenger may ask a question. <strong>A passenger's question never falls.</strong></span></div>
      </div>
      <p class="detail">Right: the doors close, the elevator goes up one floor${state.settings.sound ? ', one ding' : ''}, the bacon slides in.${state.settings.sound ? '' : ' Turn on ♪ for the ding.'}</p>
      ${/* THE CARD MUST STATE THE RULE THAT ACTUALLY RUNS (r4-elevator-feel-02, r4-autism-fit-6).
            `secondTry` ships ON, so the first wrong answer clears the entry and nothing falls — a
            rule stated only on the Grown-ups toggle, a screen the child is never sent to, while the
            card the child IS shown, unskippably, on the first Ride said "Wrong: a fall". Every other
            promise on this card is exact; a rule-literal child tests this one on their first sum.
            The card already varies on `settings.sound` one line up; this is the same mechanism. */''}
      <p>${second ? 'Wrong: the entry clears and you try again. Miss it twice and the panel shows the true sum, then the elevator falls onto the springy spikes. The safety brake catches it.' : 'Wrong: the panel shows the true sum, then the elevator falls onto the springy spikes. The safety brake catches it. A repair card shows the sum, and you answer it again.'}</p>
      <p class="never">Bacon rides on the tray and goes into the lunchbox at the roof. <strong>Bacon is never lost. There is no clock.</strong></p>
    </div>
    <div class="foot"><button class="btn primary wide" data-continue data-tap aria-label="Ride">Ride</button></div>
  </div>`
}

export function roof(state) {
  const r = state.ride || { tray: 0 }
  const info = state.roof || { gained: 0, bonus: 0, unlocked: [], plaques: [], offer: null, lunchboxBefore: state.lunchbox }
  const next = lunchboxMilestone(state.lunchbox)
  // THE FORWARD LINE MAY NEVER GO SILENT. The bacon ladder ends (the last plaque is 5000); The
  // Climb does not, because past the tallest building in the bank it counts that building again.
  // test/content-round.test.js asserts the card carries at least one of these two lines at every
  // lunchbox 0-6000 and every floor count 0-20000 (r3-elevator-feel-02, extended).
  const climbLine = climbGoalLine(state)
  const cg = climbGoal(state.records ? state.records.floors : 0, state.climb || [])
  // EVERY RUNG CROSSED, EACH ANNOUNCED ONCE (r6-elevator-feel-02). This used to take the LAST rung
  // reached and ask whether it was fewer than 11 floors back — a window exactly one clean building
  // wide, so the Woolworth (60 floors, and every roof lands on a multiple of 10) was announced on
  // two consecutive roofs, the second time reading "You have now ridden as many floors as the
  // Woolworth Building has: 60" directly above "The Climb: 2 more floors to the Shard", i.e. above
  // its own contradiction. Taking only the last rung also SWALLOWED rungs: Taipei 101 (101) and the
  // Empire State (102) are overtaken by the Willis Tower (108) inside one building and were never
  // announced at all. The reducer now records which rungs this roof crossed (state.climbShown is
  // the ledger, kept the way state.plaques is); `justReached` is the fallback for a save parked at
  // a roof card written before that ledger existed.
  const byId = new Map((state.climb || []).map((rg) => [rg.id, rg]))
  const justReached = cg.reached.length ? cg.reached[cg.reached.length - 1] : null
  const freshList = Array.isArray(info.climb)
    ? info.climb.map((id) => byId.get(id)).filter(Boolean)
    : (justReached && state.records && state.records.floors - justReached.floors < 11 ? [justReached] : [])
  const unlockedParts = info.unlocked.map((id) => PARTS.find((pp) => pp.id === id)).filter(Boolean)
  const offerLevel = info.offer ? LEVELS.find((l) => l.id === info.offer) : null
  const offerName = offerLevel ? offerLevel.name : null
  const taken = info.offerTaken ? (LEVELS.find((l) => l.id === info.offerTaken) || {}).name : null
  // A PROMOTION AND A RESCUE WERE THE SAME SENTENCE (r4-math-05). `Try Megatall?` and `Try
  // Skyscraper?` are the same eight words with the same two buttons, so after two ruinous buildings
  // the way out read exactly like a reward, and neither card said what the child was agreeing to —
  // the level's tag, which the picker has shown all along. Direction, then the tag.
  // AND AN OFFER DECLINED MANY TIMES DOES NOT READ AS THE SAME UNANSWERED QUESTION FOR EVER
  // (r6-elevator-feel-03). Tapping past the offer defers it, by design, and the identical sentence
  // then came back on every clean roof — eight in a row, measured, while the sums stayed where they
  // were. The second time onward it says so: the building is still there, and it is still the
  // child's choice.
  const again = (info.offerRun || 0) >= 1
  const offerLine = offerLevel
    ? (again
      ? `${esc(offerName)} is still there whenever you want it — ${esc(offerLevel.tag)}. ${info.dir === 'down' ? 'Go back' : 'Try it'}?`
      : `${info.dir === 'down' ? 'Back to' : 'Ready for'} ${esc(offerName)} — ${esc(offerLevel.tag)}?`)
    : ''
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
    ${info.gained === null ? '' : `<p class="gain">${info.midBanked ? `${info.gained} more bacon` : `Tray ${info.gained}`} → lunchbox</p>
    <p class="gain">+${info.bonus} roof bonus</p>`}
    <p class="total">${LUNCH} <span id="lunchbox-roof">${state.lunchbox}</span> ${BACON()}</p>
    ${unlockedParts.length ? `<div class="new-parts">${unlockedParts.map((pp) => `<span class="new-part">${partArt(pp.id)}<span><strong>New in the Workshop:</strong><br>${esc(pp.name)}</span></span>`).join('')}</div>` : ''}
    ${info.plaques.length ? `<p><strong>A plaque for ${esc(info.plaques.join(' and '))} bacon hangs in the Lobby.</strong></p>` : ''}
    ${freshList.map((fresh) => `<p data-climb-reached="${esc(fresh.id)}"><strong>You have now ridden as many floors as ${esc(fresh.name)} has: ${fresh.floors}.</strong><br><span class="small">${esc(fresh.line)}</span></p>`).join('')}
    ${next ? `<p class="muted" data-next-goal>${next.part ? `Next part at ${next.at} bacon: ${esc(next.part.name)} — ${next.at - state.lunchbox} more` : `Next plaque at ${next.at} bacon — ${next.at - state.lunchbox} more`}</p>` : ''}
    ${climbLine ? `<p class="muted" data-climb-goal>${esc(climbLine)}</p>` : ''}
    ${taken ? `<p><strong>Next building: ${esc(taken)}.</strong></p>` : ''}
    ${/* WHAT CUSTOM CAN ACTUALLY DO (r5-math-03). This line used to promise "smaller numbers
          still", and no reachable Grown-ups setting delivers that: Corner Shop step 1 tops out at 5
          with a mean largest number of 3.78, while the lowest table the Custom steppers can build
          tops out at 6 with a mean of 4.38 (ADD_FLOOR, src/levels.js, exists to stop the pool
          collapsing to a handful of sums). Swept all 127 operation subsets against every reachable
          stepper value: nothing goes below Corner Shop step 1. What Custom really gives a drowning
          child is FEWER SHAPES - Corner Shop step 1 serves add, take away, ▲ and ▼, and Custom can
          serve one - so that is what the card offers. */''}
    ${info.help ? `<p class="muted small" data-roof-help>Corner Shop is the smallest building. A grown-up can give one kind of sum at a time, and choose the numbers: Grown-ups → Custom numbers.</p>` : ''}
  </div>
  ${/* THE FOOT IS NOT INSIDE THE SCROLLER (r4-code-hostile-01, r4-autism-fit-1, r4-elevator-feel-01,
        r4-mobile-ux-1). It used to be the last block of the `.page` with `position: sticky; bottom:
        0` and an opaque paper background, so on every phone the project ships a profile for it
        painted over the card it was pinned inside: the part unlock 100 % hidden at 320 x 454, the
        lunchbox total sliced through its digits, both forward-goal lines covered, and — the worst
        of it — the level offer drawn UNDER the two buttons, where a tap at the centre of `Yes`
        dispatched `to-lobby` or `next-building` instead. The offer is the only in-game route up the
        ladder (DESIGN §4), so it moves into the foot with the buttons where it cannot be covered,
        and the body below scrolls with its own cue and nothing on top of it. Same two-band shape as
        `.sheet .body` / `.sheet .foot`, which the Rules card and the fact card have always used. */''}
  ${/* A QUESTION AND FOUR BUTTONS, AND THE LOUDEST ONE WAS NOT AN ANSWER (r5-autism-fit-1,
        r5-elevator-feel-01). `Next building` carries `btn primary tall wide` - the game's one "this
        is the thing to tap" idiom, used in exactly one other place, the Lobby's `Ride` - so while
        an offer stood, two blue primaries sat 8 px apart on one card meaning different things, and
        the bigger one (2.6x the pixel area of `Yes` at 390 px, and 24 px type against 18) did not
        answer the question printed above it. A child who has learned that the big blue button means
        keep going never accepts. `Stay` remains the primary and the default, which is DESIGN 4's
        ruling and the reason the offer exists at all; what changes is that while the question is
        unanswered it is the ONLY primary, the navigation buttons drop to plain, and the question and
        its two answers are drawn as one bordered block so proximity cannot make four buttons read as
        four answers. Nothing is gated: tapping past the offer still defers it to the next roof, and
        `step3Run` is untouched, so the same offer comes back on the very next clean building. */''}
  <div class="foot">
    ${offerLine ? `<div class="offer"><p class="offerq" data-offer-q>${offerLine}</p><div class="row"><button class="btn" style="flex:1" data-offer="yes" data-tap aria-label="Yes, ${esc(offerName)}">Yes</button><button class="btn" style="flex:1" data-offer="stay" data-tap aria-label="Stay">Stay</button></div></div>` : ''}
    <div class="stack">
      <button class="btn ${offerLine ? 'wide' : 'primary tall wide'}" data-next data-tap aria-label="Next building">Next building</button>
      <button class="btn wide" data-nav="lobby" data-tap aria-label="Lobby, ride down">Lobby</button>
    </div>
  </div>`
}

// THE FACT BOOK GETS A COUNT AND A BOARD. `23 of 67 facts collected` plus a ghost tile for every
// fact not yet heard: for a child who counts things, an empty slot beside a full one is the whole
// engine. The two view controls are settings, so the choice survives a reload — and neither of them
// changes a fact, a count or a distance.
export function factbook(state) {
  const byId = new Map(state.pool.map((f) => [f.id, f]))
  const kind = state.settings.bookKind || 'all'
  const order = state.settings.bookOrder || 'newest'
  const inKind = (f) => kind === 'all' || f.kind === kind
  const seen = [...new Set(state.facts.seen)]
  const heardAll = seen.map((id) => byId.get(id)).filter(Boolean)
  const heard = heardAll.filter(inKind)
  const items = order === 'newest' ? heard.slice().reverse() : heard
  const unheard = state.pool.filter((f) => !seen.includes(f.id) && inKind(f))
  const links = state.settings.links
  const total = state.pool.filter(inKind).length
  const chip = (key, val, label, cur) => `<button class="radio small-radio" role="radio" aria-checked="${cur === val ? 'true' : 'false'}" data-setting="${key}" data-value="${val}" data-tap aria-label="${esc(label)}">${esc(label)}</button>`
  return `<div class="page">
    <div class="row spread"><h1>Fact Book</h1><button class="btn" data-nav="lobby" data-tap aria-label="Back to lobby">Lobby</button></div>
    <p class="count" id="factcount">${heardAll.length} of ${state.pool.length} facts collected · ${state.facts.right.length} answered right.</p>
    <div class="radio-row" role="radiogroup" aria-label="Which facts">
      ${chip('bookKind', 'all', 'All', kind)}${chip('bookKind', 'elevator', 'Elevator', kind)}${chip('bookKind', 'math', 'Numbers', kind)}
    </div>
    <div class="radio-row" role="radiogroup" aria-label="Order" style="margin-top:8px">
      ${chip('bookOrder', 'newest', 'Newest', order)}${chip('bookOrder', 'order', 'In order', order)}
    </div>
    <p class="muted small">${items.length ? '' : 'Passengers step in on the ? floors. Every fact they tell you is written here. '}More passengers ride in the bigger buildings.</p>
    ${items.map((f) => `<div class="book-item" data-fact="${f.id}">
      <p class="q">${esc(f.q)}</p>
      <p><strong>Answer:</strong> ${esc(f.answer)}${state.facts.right.includes(f.id) ? ' <span class="muted small">(you got it)</span>' : ''}</p>
      <p>${esc(f.fact)}</p>
      ${f.sources.map((src) => `<p class="src">Source: ${links ? `<a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">${esc(src.title)}</a>` : esc(src.title)} (${esc(domainOf(src.url))})</p>`).join('')}
    </div>`).join('')}
    ${unheard.length ? `<h2>Not heard yet</h2>
    <p class="muted small">${unheard.length} of ${total} still to collect.</p>
    <div class="ghosts">${unheard.map((f) => `<span class="ghost" data-fact-ghost="${f.id}" role="img" aria-label="not heard yet"></span>`).join('')}</div>` : (state.pool.length ? '<p class="muted small">Every fact in the book has been heard.</p>' : '')}
  </div>`
}

// THE WORKSHOP IS THE SECOND FACT BOOK. It is where an elevator-loving child goes to READ about
// real mechanisms, not only to toggle them — every row carries the drawing and an ⓘ that opens a
// card with one true sentence and its source. Seven slots, 24 parts.
//
// Three rules the markup enforces, all of them the lead's ruling:
//  - NO MYSTERY BOXES. A locked row prints its full name, its drawing, its threshold and the exact
//    number of strips left. Nothing is ever a silhouette or a "???".
//  - NOTHING IS EVER AUTO-EQUIPPED OR RE-LOCKED. An unlocked row is a radio the child taps; the
//    game never taps it for them.
//  - THE NEXT THING IS AT THE TOP. #workshop-next names it, draws it and counts down to it.
export function workshop(state, extras = {}) {
  const next = nextPart(state.lunchbox)
  const owned = partsOwned(state.unlocks)
  const nextLine = next
    ? `<div class="next-part" id="workshop-next">${partArt(next.id, 'part-art next')}<span><strong>Next part: ${esc(next.name)}</strong><br><span class="muted small">at ${next.at} bacon · ${next.at - state.lunchbox} more</span></span></div>`
    : `<div class="next-part" id="workshop-next"><span><strong>Every part is in the lift.</strong><br><span class="muted small">${esc(climbGoalLine(state))}</span></span></div>`
  return `<div class="page">
    <div class="row spread"><h1>Workshop</h1><button class="btn" data-nav="lobby" data-tap aria-label="Back to lobby">Lobby</button></div>
    <p class="muted small">Real elevator parts. Bacon in the lunchbox unlocks them, and they stay unlocked. Lunchbox: ${state.lunchbox}. Parts: ${owned.owned} of ${owned.total}.</p>
    ${nextLine}
    ${SLOTS.map((slot) => `<h2>${esc(slot.title)}</h2><div class="parts" role="radiogroup" aria-label="${esc(slot.title)}">
      ${partsBySlot(slot.id).map((pt) => {
        const unlocked = isUnlocked(pt, state.unlocks)
        const checked = state.equipped[slot.id] === pt.id
        const away = pt.at - state.lunchbox
        const sub = unlocked ? (checked ? 'fitted' : 'tap to fit') : `at ${pt.at} bacon · ${away} more`
        return `<div class="part-row">
          <button class="radio part ${unlocked ? '' : 'locked'}" role="radio" aria-checked="${checked ? 'true' : 'false'}" data-equip-slot="${slot.id}" data-equip-part="${pt.id}" data-tap ${unlocked ? '' : 'disabled'} aria-label="${esc(pt.name)}${unlocked ? '' : `, unlocks at ${pt.at} bacon, ${away} more`}">${partArt(pt.id)}<span class="pname">${esc(pt.name)}<br><small class="muted">${esc(sub)}</small></span></button>
          <button class="btn info" data-part-card="${pt.id}" data-tap aria-label="What is a ${esc(pt.name)}?">ⓘ</button>
        </div>`
      }).join('')}
    </div>`).join('')}
    <h2>Plaques</h2>
    <div class="plaques">${PLAQUES.map((pl) => state.plaques.includes(String(pl)) ? `<span class="plaque">${pl} bacon</span>` : `<span class="plaque" style="opacity:.4">${pl}</span>`).join('')}</div>
  </div>${partCard(state, extras.partCard)}`
}

// The card behind the ⓘ: the drawing large, one true sentence, and the source as plain text (a link
// only where the Fact Book links, and only when a grown-up has turned links on).
export function partCard(state, id) {
  if (!id) return ''
  const pt = partById(id)
  if (!pt) return ''
  const card = (state.partsPool || []).find((c) => c.id === id)
  return `<div class="sheet part-sheet" role="dialog" aria-label="${esc(pt.name)}">
    <div class="body">
      <p class="q">${esc(pt.name)}</p>
      <div class="part-big">${partArt(id, 'part-art big')}</div>
      ${card ? `<p class="factline">${esc(card.real)}</p>` : '<p class="factline muted">The card for this part did not load. The part still works.</p>'}
      ${card ? card.sources.map((src) => `<p class="src">Source: ${state.settings.links ? `<a href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">${esc(src.title)}</a>` : esc(src.title)} (${esc(domainOf(src.url))})</p>`).join('') : ''}
    </div>
    <div class="foot"><button class="btn primary wide" data-part-close data-tap aria-label="Got it">Got it</button></div>
  </div>`
}

// ---- the Logbook -----------------------------------------------------------------------------
// A collector does four things with a collection: sorts it, counts it, re-reads it and shows it.
// This is the shelf. Three blocks, and every number on all three only ever RISES.
//
// FALLS APPEAR NOWHERE HERE, and neither does an accuracy, a percentage or a streak. A number a
// child can see must never be able to go down; the parent's figures (falls, accuracy) live on the
// Grown-ups page, which the child does not reach.
//
// The tickets are DERIVED from `buildings`, which the save already carried. An array of one entry
// per building would grow the BE1- code a grown-up may have to copy by hand without bound — the
// bug round 2 fixed once already, in `facts.seen`.
export function logbook(state) {
  const r = state.records || { floors: 0, rides: 0, longest: 0, passengers: 0 }
  const owned = partsOwned(state.unlocks)
  const heard = new Set(state.facts.seen).size
  const g = climbGoal(r.floors, state.climb || [])
  const reached = new Set(g.reached.map((x) => x.id))
  const n = state.buildings
  const show = Math.min(n, 24)
  const tickets = n === 0
    ? '<p class="muted small">A ticket prints at the roof of every building. The first one is nine sums away.</p>'
    : `<div class="tickets">${Array.from({ length: show }, (_, i) => ticket(n - show + i + 1)).join('')}</div>${n > show ? `<p class="muted small">…and ${n - show} more before these.</p>` : ''}`
  const rows = [
    ['buildings', 'Buildings ridden', String(n)],
    ['floors', 'Floors ridden', String(r.floors)],
    ['longest', 'Longest single ride', r.longest ? `${r.longest} floor${r.longest === 1 ? '' : 's'}` : '0'],
    ['rides', 'Rides', String(r.rides)],
    ['passengers', 'Passengers met', String(r.passengers)],
    ['sums', 'Sums answered', String(state.history.answered)],
    ['facts', 'Facts collected', `${heard} of ${state.pool.length || heard}`],
    ['parts', 'Parts owned', `${owned.owned} of ${owned.total}`],
    ['bacon', 'Bacon in the lunchbox', String(state.lunchbox)],
  ]
  return `<div class="page">
    <div class="row spread"><h1>Logbook</h1><button class="btn" data-nav="lobby" data-tap aria-label="Back to lobby">Lobby</button></div>
    <h2>Tickets</h2>
    ${tickets}
    <h2>Records</h2>
    <div class="records" id="records">${rows.map(([k, lab, val]) => `<div class="rec" data-record="${k}"><span class="lab">${esc(lab)}</span><span class="val">${esc(val)}</span></div>`).join('')}</div>
    <h2>The Climb</h2>
    <p class="muted small">Every floor the lift carries you counts. ${esc(climbGoalLine(state))}</p>
    ${(state.climb || []).map((rung) => {
      const done = reached.has(rung.id)
      return `<div class="climb-row ${done ? 'reached' : ''}" data-climb="${rung.id}" data-reached="${done ? 'true' : 'false'}">
        <span class="floors">${rung.floors}</span>
        <span class="who"><strong>${esc(rung.name)}</strong>, ${esc(rung.city)}<br>
          ${done ? `<span class="small">${esc(rung.line)}</span>` : `<span class="muted small">${rung.floors - r.floors} floors to go</span>`}
          ${done ? rung.sources.map((src) => `<span class="src">Source: ${esc(src.title)} (${esc(domainOf(src.url))})</span>`).join('') : ''}
        </span>
      </div>`
    }).join('')}
    ${g.next && g.next.times > 1 ? `<p class="muted small">Past the tallest building there is still a next one: ${esc(climbLabel(g.next))}, ${g.next.floors} floors.</p>` : ''}
  </div>`
}

// A conductor's paper ticket: the perforated edge, the number, and ten punched holes — one per stop
// from G to R, which is exactly what a building is.
function ticket(n) {
  return `<svg class="ticket" viewBox="0 0 96 40" data-ticket="${n}" aria-label="ticket number ${n}">
    <rect x="6" y="2" width="88" height="36" rx="3" fill="#F8F5EE" stroke="#6B6B6B" stroke-width="2"/>
    <line x1="14" y1="2" x2="14" y2="38" stroke="#6B6B6B" stroke-width="1.5" stroke-dasharray="3 3"/>
    ${[8, 20, 32].map((cy) => `<circle cx="6" cy="${cy}" r="3" fill="#F4F1EA" stroke="#6B6B6B" stroke-width="1.5"/>`).join('')}
    <text x="20" y="16" font-family="ui-monospace, monospace" font-weight="700" font-size="11" fill="#2B2B2B">No. ${String(n).padStart(4, '0')}</text>
    <text x="20" y="27" font-family="system-ui, sans-serif" font-size="9" fill="#6F6B62">G → R</text>
    ${Array.from({ length: 10 }, (_, i) => `<circle cx="${22 + i * 6.4}" cy="33" r="1.6" fill="#6B6B6B"/>`).join('')}
    <use href="#bacon" x="66" y="18" width="24" height="12"/>
  </svg>`
}

function toggle(key, label, on, note) {
  return `<div class="setting"><span class="label">${esc(label)}${note ? `<small>${esc(note)}</small>` : ''}</span><button class="btn ${on ? 'on' : ''}" data-setting="${key}" data-value="${on ? 'false' : 'true'}" data-tap role="switch" aria-checked="${on ? 'true' : 'false'}" aria-label="${esc(label)}">${on ? 'On' : 'Off'}</button></div>`
}
// `stack` marks the rows whose control group is a set of 56 px keys: on a phone those wrap, and a
// label vertically centred against a wrapped group names the middle of it rather than the top of it
// (r6-mobile-ux-5). The toggles and steppers are one control wide and are left alone.
function radios(key, label, opts, cur) {
  return `<div class="setting stack"><span class="label">${esc(label)}</span><span class="radio-row" role="radiogroup" aria-label="${esc(label)}">${opts.map(([v, t]) => `<button class="radio" role="radio" aria-checked="${cur === v ? 'true' : 'false'}" data-setting="${key}" data-value="${v}" data-tap aria-label="${esc(t)}">${esc(t)}</button>`).join('')}</span></div>`
}
// A LIT, UNDIMMED KEY THAT DOES NOTHING IS A DEAD KEY (r6-code-hostile-3) - the rule the panel
// already enforces on GO, on ⌫ and on the digit cap, and the one screen it had never reached was
// the one a grown-up uses. Every stepper drew both buttons live at its limits with an out-of-range
// data-value: tapping − on Volume at 0 emitted `-10`, set-setting clamped it back to 0, a SAVE was
// written and nothing on screen moved or said why. `lo`/`hi` are the SAME bounds set-setting
// clamps to, passed in rather than restated as a rule of thumb, so a button is dead exactly when
// the reducer would refuse it.
function stepper(key, label, val, delta, lo, hi, note) {
  const at = (v) => Math.max(lo, Math.min(hi, v)) === val
  const btn = (v, dir, glyph) => `<button class="btn"${at(v) ? ' disabled aria-disabled="true"' : ''} data-setting="${key}" data-value="${Math.max(lo, Math.min(hi, v))}" data-tap aria-label="${esc(label)} ${dir}">${glyph}</button>`
  return `<div class="setting"><span class="label">${esc(label)}${note ? `<small>${esc(note)}</small>` : ''}</span><span class="stepper">${btn(val - delta, 'down', '−')}<span class="val" aria-live="polite">${val}</span>${btn(val + delta, 'up', '+')}</span></div>`
}

// The shapes the game asks, in the order the ladder teaches them, with the child's first-try
// accuracy on each. Only shapes that have actually been asked appear.
const KIND_NAME = { add: 'Adding  a + b', sub: 'Taking away  a − b', mul: 'Times  a × b', div: 'Sharing  a ÷ b', missAdd: 'The missing number  a + ▮ = c', missMul: 'The missing number  ▮ × b = c', up: 'Floor up  a ▲ b', down: 'Floor down  a ▼ b' }
const KIND_ORDER = ['add', 'sub', 'up', 'down', 'missAdd', 'mul', 'div', 'missMul']
export function byKindHTML(state) {
  const bk = (state.history && state.history.byKind) || {}
  const rows = KIND_ORDER.filter((k) => Array.isArray(bk[k]) && bk[k][0] > 0)
  if (!rows.length) return ''
  return `<div class="records" data-bykind>${rows.map((k) => {
    const [asked, right] = bk[k]
    return `<div class="rec"><span class="lab">${esc(KIND_NAME[k] || k)}</span><span class="val">${right} of ${asked} (${Math.round((100 * right) / asked)}%)</span></div>`
  }).join('')}</div>`
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
    ${stepper('volume', 'Volume', s.volume, 10, 0, 100)}
    <h2>Elevator</h2>
    ${radios('speed', 'Speed', [['normal', 'Normal'], ['fast', 'Fast']], s.speed)}
    ${radios('motion', 'Motion', [['auto', 'Auto'], ['full', 'Full'], ['reduced', 'Reduced']], s.motion)}
    ${radios('passengers', 'Passengers', [['often', 'Often'], ['sometimes', 'Sometimes'], ['never', 'Never']], s.passengers)}
    <h2>Maths</h2>
    ${toggle('secondTry', 'Second try', s.secondTry, 'The first wrong answer clears the entry; only the second falls.')}
    ${toggle('adaptive', 'Adaptive step', state.adaptive, 'Three right in a row: step up. A fall: step down, once per building. The elevator says so in words: "Bigger numbers now."')}
    ${state.adaptive ? '' : stepper('pinnedStep', 'Pinned step', state.pinnedStep, 1, 1, 3)}
    <h2>Level</h2>
    <div class="radio-row" role="radiogroup" aria-label="Level">
      ${[...LEVELS.map((l) => [l.id, `${l.name} — ${l.tag}`]), ['custom', 'Custom']].map(([id, name]) => `<button class="radio" role="radio" aria-checked="${state.level === id ? 'true' : 'false'}" data-level="${id}" data-tap aria-label="${esc(name)}">${esc(name)}</button>`).join('')}
    </div>
    <h2>Custom numbers</h2>
    <div class="setting stack"><span class="label">Operations</span><span class="radio-row">${ops.map(([id, t]) => `<button class="radio" role="checkbox" aria-checked="${c.ops.includes(id) ? 'true' : 'false'}" data-custom-op="${id}" data-tap aria-label="${esc(t)}">${esc(t)}</button>`).join('')}</span></div>
    ${stepper('custom.min', 'Smallest number', c.min, 5, 0, c.max - 2)}
    ${stepper('custom.max', 'Largest number', c.max, 5, c.min + 2, 9999)}
    ${toggle('custom.negatives', 'Negative answers', c.negatives)}
    <h2>Reading</h2>
    ${toggle('bigText', 'Bigger text', s.bigText)}
    ${toggle('links', 'Open source links', s.links, 'Off: sources are plain text. On: the Fact Book links to them.')}
    ${noticeHTML(extras)}
    <h2>Progress</h2>
    <p class="muted small">For you, not for the child: the Logbook they see carries no falls, no accuracy and no streak, because a number a child can see must never be able to go down.</p>
    <div class="records">
      <div class="rec"><span class="lab">Buildings ridden</span><span class="val">${state.buildings}</span></div>
      <div class="rec"><span class="lab">Sums answered</span><span class="val">${state.history.answered}</span></div>
      <div class="rec"><span class="lab">Answered right first time</span><span class="val">${state.history.correct}${state.history.answered ? ` (${Math.round((100 * state.history.correct) / state.history.answered)}%)` : ''}</span></div>
      <div class="rec"><span class="lab">Falls</span><span class="val">${state.history.falls}</span></div>
      <div class="rec"><span class="lab">Floors ridden</span><span class="val">${(state.records || {}).floors || 0}</span></div>
      <div class="rec"><span class="lab">Passengers met</span><span class="val">${(state.records || {}).passengers || 0}</span></div>
    </div>
    ${/* WHICH FORM IS FAILING, not merely how many falls (r4-math-01). history.byKind has been
          recorded since round 1 and printed nowhere, so `51 %, 146 falls` was the alarm with no
          diagnosis: a child stuck on one shape — the missing-number form is the one the game
          teaches last — looked exactly like a child who is simply tired. Falls are not the measure
          here; first-time accuracy per shape is, because that is what the ladder itself reads. */''}
    ${byKindHTML(state)}
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
    ${/* ONLY THE CHILD COULD PULL A NEW BUILD IN (r4-deploy-pages-03). This line showed WHICH build
          the phone is on and gave no way to act on it: the single route to a newer one was the
          update chip on the lobby, which a child can dismiss with ✕ every session, and the
          undocumented ?reset=1 hatch costs the lunchbox. When a worker is waiting the version line
          is the button; otherwise it is the same sentence it always was. */''}
    ${extras.updateWaiting
      ? `<button class="btn wide" data-update data-tap style="margin-top:20px" aria-label="Load the new version">Load the new version · ${esc(extras.version || '')}${extras.build ? ` · ${esc(extras.build)}` : ''}</button><p class="muted small">The lunchbox is kept.</p>`
      : `<p class="muted small" style="margin-top:20px">Version ${esc(extras.version || '')}${extras.build ? ` · ${esc(extras.build)}` : ''}</p>`}
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
      <p class="verdict ${right ? 'right' : ''}">You chose ${esc(letterFor(t.chosen))}: ${esc(chosen)}.${right ? ' +2 bacon' : ''}</p>
      ${right ? '' : `<p class="verdict">The answer is ${esc(letterFor(t.answer))}: ${esc(t.fact.answer)}.</p>`}
      ${/* THE FEEDBACK FOR A MISS WAS AN ABSENCE (r5-autism-fit-5). A right answer prints "+2
            bacon"; a wrong one printed nothing where that line had been, and a child who counts
            bacon was left to infer both that none arrived and that the passenger is gone for good.
            Neither is a thing to work out from a gap. Same register as the Repair card's "Nobody is
            hurt. Nothing is lost." - and the second half is true: pickFact re-serves a missed fact
            once 20 questions have passed. */''}
      ${right ? '' : '<p class="verdict">0 bacon this time. Nothing is lost. This passenger asks again later.</p>'}
      <p class="factline">${esc(t.fact.fact)}</p>
      ${t.fact.sources.map((s) => `<p class="src">Source: ${esc(s.title)} (${esc(domainOf(s.url))})</p>`).join('')}
    </div>
    <div class="foot"><button class="btn primary wide" data-continue data-tap aria-label="Got it">Got it</button></div>
  </div>`
}
