import { fetchIncidents, ack } from './api.js';

const REFRESH_MS = 2000; // R4

const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const list = document.querySelector('[data-testid="incident-list"]');
const errorBox = document.querySelector('.error');
const newBar = document.querySelector('[data-testid="new-bar"]');

/** Rows on the board, by incident id. */
const rows = new Map();
const acked = new Set();

// R5: viewer's own zone and own day/month order (en-GB, de-DE … → dd/mm; en-US → mm/dd).
const fmt = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short',
});

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function markAcked(row, reply) {
  const btn = row.querySelector('[data-testid="ack"]');
  if (btn) btn.remove();
  if (!row.querySelector('[data-testid="acked"]')) {
    const mark = el('span', { 'data-testid': 'acked', class: 'acked' }, 'acked');
    if (reply?.ackedAt) mark.title = `acked ${fmt.format(new Date(reply.ackedAt))}`;
    row.querySelector('.act').append(mark);
  }
  row.classList.add('is-acked');
}

function buildRow(i) {
  const row = el('li', { 'data-testid': 'incident-row', 'data-id': i.id, class: `row ${i.severity}` });
  row.append(
    el('span', { class: 'id' }, i.id),
    el('span', { class: 'sev' }, i.severity),
    el('span', { class: 'what' }, `${i.service} · ${i.region} · ${i.summary}`),
  );
  const time = el('time', { datetime: i.openedAt, title: i.openedAt }, fmt.format(new Date(i.openedAt)));
  row.append(time);

  const act = el('span', { class: 'act' });
  const btn = el('button', { type: 'button', 'data-testid': 'ack' }, 'Ack');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Acking…';
    try {
      const reply = await ack(i.id); // R2
      acked.add(i.id);
      markAcked(row, reply);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Ack';
      showError(err);
    }
  });
  act.append(btn);
  row.append(act);
  if (acked.has(i.id)) markAcked(row);
  return row;
}

function showError(err) {
  errorBox.textContent = String(err?.message ?? err);
  errorBox.hidden = false;
}

/**
 * R1 (as product decided after the step-1 recording): the list holds still while it is on screen.
 * The first answer fills it; after that, incidents not on the board wait behind the "N new" bar and
 * come in at the top only when on-call clicks it. Rows already on the board are never moved or removed.
 */
const pending = new Map();

function addOnTop(incidents) {
  const sorted = [...incidents].sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt));
  const frag = document.createDocumentFragment();
  for (const i of sorted) {
    const row = buildRow(i);
    rows.set(i.id, row);
    frag.append(row);
  }
  list.prepend(frag);
}

function render(incidents) {
  const fresh = incidents.filter((i) => !rows.has(i.id));
  if (rows.size === 0) addOnTop(fresh);
  else for (const i of fresh) pending.set(i.id, i);
  newBar.textContent = `${pending.size} new incident${pending.size === 1 ? '' : 's'} \u2014 show`;
  newBar.hidden = pending.size === 0;
  empty.hidden = rows.size > 0 || pending.size > 0;
}

newBar.addEventListener('click', () => {
  addOnTop([...pending.values()]);
  pending.clear();
  newBar.hidden = true;
  empty.hidden = rows.size > 0;
  list.hidden = false;
});

let busy = false;
async function refresh() {
  if (busy) return;
  busy = true;
  try {
    const page = await fetchIncidents();
    render(page.incidents);
    errorBox.hidden = true;
    loader.hidden = true; // R3: gone once incidents are on screen
    list.hidden = false;
  } catch (err) {
    showError(err);
  } finally {
    busy = false;
  }
}

await refresh();
setInterval(refresh, REFRESH_MS); // R4
