import { fetchIncidents, ack } from './api.js';

const REFRESH_MS = 2000; // R4

const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const list = document.querySelector('[data-testid="incident-list"]');
const errorBox = document.querySelector('.error');

/** Rows we have built, by incident id, so acked state survives refreshes. */
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

/** R1: newest first, new ones at the top. Existing rows are reused, not rebuilt. */
function render(incidents) {
  const sorted = [...incidents].sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt));
  const seen = new Set();
  let prev = null;
  for (const i of sorted) {
    seen.add(i.id);
    let row = rows.get(i.id);
    if (!row) {
      row = buildRow(i);
      rows.set(i.id, row);
    }
    const want = prev ? prev.nextSibling : list.firstChild;
    if (want !== row) list.insertBefore(row, want);
    prev = row;
  }
  for (const [id, row] of rows) {
    if (!seen.has(id)) {
      row.remove();
      rows.delete(id);
    }
  }
  empty.hidden = sorted.length > 0;
}

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
