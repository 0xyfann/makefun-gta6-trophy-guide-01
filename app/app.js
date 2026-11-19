const trophies = window.leonidaCatalog;
const byId = new Map(trophies.map(trophy => [trophy.id, trophy]));
const byName = new Map(trophies.map(trophy => [trophy.name, trophy.id]));
const storageKey = 'leonida-ledger.v1';
const grades = ['platinum', 'gold', 'silver', 'bronze'];
const categories = {
  all: 'All', story: 'Story', missable: 'Missable', collectibles: 'Collectibles',
  activities: 'Activities', side: 'Strangers', online: 'Online', finish: 'Completion',
};
const $ = id => document.getElementById(id);
const titleCase = word => word[0].toUpperCase() + word.slice(1);
let earned = new Set();
let hideStory = false;
let kind = 'all';
let view = 'tracker';
let selectedId = 2;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function notice(text) {
  $('notice').textContent = text;
  $('notice').hidden = !text;
}

function normalizeEarned(entries) {
  if (!Array.isArray(entries)) throw new Error('Missing earned trophy list');
  return new Set(entries.map(value => {
    const id = typeof value === 'string' ? byName.get(value) : value;
    if (!byId.has(id)) throw new Error('Unknown trophy in progress file');
    return id;
  }));
}

function restore() {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
      const state = JSON.parse(stored);
      earned = normalizeEarned(state.earned);
      hideStory = state.hideStory === true;
    } else {
      earned = normalizeEarned(JSON.parse(localStorage.getItem('gta6-trophy-checklist') ?? '[]'));
    }
  } catch {
    notice('Saved progress could not be loaded. You can restore it with Import.');
  }
  $('spoilers').checked = hideStory;
}

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({earned: [...earned], hideStory}));
    return true;
  } catch {
    notice('Browser storage is unavailable. Export to keep a copy of your progress.');
    return false;
  }
}

function concealed(trophy) {
  return hideStory && trophy.kind === 'story' && !earned.has(trophy.id);
}

function trophyName(trophy) {
  return concealed(trophy) ? `Hidden story trophy #${trophy.id}` : trophy.name;
}

function gradeChip(grade) {
  return node('span', `grade ${grade}`, titleCase(grade));
}

function trophyTag(trophy) {
  const label = trophy.missable ? 'Potential missable' : categories[trophy.kind];
  return node('span', `tag${trophy.missable ? ' risk' : ''}`, label);
}

function refreshProgress() {
  $('earned-count').textContent = earned.size;
  $('percentage').textContent = `${Math.round(earned.size * 100 / trophies.length)}%`;
  $('progress').value = earned.size;
  $('grade-counts').replaceChildren(...grades.map(grade => {
    const group = trophies.filter(trophy => trophy.grade === grade);
    const total = group.filter(trophy => earned.has(trophy.id)).length;
    return node('span', grade, `${titleCase(grade)} ${total}/${group.length}`);
  }));
}

function matchesKind(trophy, category) {
  if (category === 'all') return true;
  if (category === 'missable') return trophy.missable;
  return trophy.kind === category;
}

function filterTrophies() {
  const search = $('search').value.trim().toLocaleLowerCase();
  const status = $('status-filter').value;
  const grade = $('grade-filter').value;
  return trophies.filter(trophy => {
    if (!matchesKind(trophy, kind)) return false;
    if (grade !== 'all' && trophy.grade !== grade) return false;
    if (status !== 'all' && earned.has(trophy.id) !== (status === 'earned')) return false;
    const searchable = concealed(trophy) ? trophyName(trophy) : `${trophy.name} ${trophy.description}`;
    return searchable.toLocaleLowerCase().includes(search);
  });
}

function renderFilters() {
  $('kind-filters').replaceChildren(...Object.entries(categories).map(([key, label]) => {
    const count = trophies.filter(trophy => matchesKind(trophy, key)).length;
    const button = node('button', 'filter', `${label} ${count}`);
    button.type = 'button';
    button.dataset.kind = key;
    button.setAttribute('aria-pressed', String(key === kind));
    button.addEventListener('click', () => {
      kind = key;
      for (const filter of $('kind-filters').children) {
        filter.setAttribute('aria-pressed', String(filter === button));
      }
      renderTracker();
    });
    return button;
  }));
}

function renderEntry(trophy) {
  const item = node('li', 'entry');
  item.dataset.id = trophy.id;
  item.classList.toggle('selected', trophy.id === selectedId);
  item.classList.toggle('earned', earned.has(trophy.id));
  const tick = node('input', 'tick');
  tick.type = 'checkbox';
  tick.checked = earned.has(trophy.id);
  tick.setAttribute('aria-label', `Earned: ${trophyName(trophy)}`);
  tick.addEventListener('change', () => setEarned(trophy, tick.checked, 'tick'));
  const open = node('button', 'entry-open');
  open.type = 'button';
  open.setAttribute('aria-pressed', String(trophy.id === selectedId));
  open.append(node('strong', 'entry-name', trophyName(trophy)),
    node('span', 'entry-description', concealed(trophy) ? 'Earn to reveal title and description.' : trophy.description));
  open.addEventListener('click', () => {
    selectedId = trophy.id;
    for (const row of $('trophy-list').children) {
      const active = row === item;
      row.classList.toggle('selected', active);
      row.querySelector('button').setAttribute('aria-pressed', String(active));
    }
    renderGuide(trophy);
    if (matchMedia('(max-width: 760px)').matches) {
      $('guide-title').focus({preventScroll: true});
      $('guide').scrollIntoView({block: 'nearest'});
    }
  });
  const metadata = node('span', 'entry-meta');
  metadata.append(gradeChip(trophy.grade), trophyTag(trophy));
  item.append(tick, open, metadata);
  return item;
}

function setEarned(trophy, value, origin) {
  if (value) earned.add(trophy.id);
  else earned.delete(trophy.id);
  persist();
  render();
  const row = $(`trophy-list`).querySelector(`[data-id="${trophy.id}"]`);
  const nextFocus = origin === 'tick' ? row?.querySelector('.tick') : $('guide-toggle');
  (nextFocus ?? $('status-filter')).focus({preventScroll: true});
}

function renderGuide(trophy) {
  const panel = $('guide');
  panel.replaceChildren();
  panel.hidden = !trophy;
  if (!trophy) return;
  const hidden = concealed(trophy);
  const heading = node('div', 'guide-kicker');
  heading.append(node('span', 'label', `TROPHY GUIDE / ${String(trophy.id).padStart(2, '0')}`), gradeChip(trophy.grade));
  const title = node('h2', '', trophyName(trophy));
  title.id = 'guide-title';
  title.tabIndex = -1;
  const quote = node('p', 'official', hidden ? 'Mark this trophy earned to reveal its details.' : trophy.description);
  panel.append(heading, title, quote);
  if (!hidden) {
    if (trophy.target) {
      const target = node('div', 'target');
      target.append(node('strong', '', trophy.target.toLocaleString('en-US')), node('span', '', trophy.unit));
      panel.append(target);
    }
    panel.append(node('h3', '', 'How to unlock'), node('p', 'guidance', trophy.guide));
    const risk = node('div', `risk-note${trophy.missable ? ' flagged' : ''}`);
    risk.append(node('strong', '', trophy.missable ? 'Potential missable' : 'No lockout stated'),
      node('p', '', trophy.risk ?? 'The official description gives no deadline.'));
    panel.append(risk);
    const source = node('div', 'source');
    source.append(node('span', 'label', 'SOURCES'));
    const links = node('ul', 'source-links');
    for (const {name, url} of trophy.sources) {
      const item = node('li');
      const link = node('a', '', name);
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      item.append(link);
      links.append(item);
    }
    source.append(links);
    panel.append(source);
  }
  const toggle = node('button', 'guide-toggle', earned.has(trophy.id) ? '✓ Earned · undo' : 'Mark as earned');
  toggle.id = 'guide-toggle';
  toggle.type = 'button';
  toggle.addEventListener('click', () => setEarned(trophy, !earned.has(trophy.id), 'guide'));
  panel.append(toggle);
}

function renderTracker() {
  const list = filterTrophies();
  if (!list.some(trophy => trophy.id === selectedId)) selectedId = list[0]?.id;
  $('trophy-list').replaceChildren(...list.map(renderEntry));
  $('result-count').textContent = `${list.length} of ${trophies.length} shown`;
  $('empty').hidden = list.length > 0;
  $('empty').textContent = kind === 'online'
    ? 'The supplied PS5 list identifies no online-only trophies.'
    : 'No matching trophies. Try clearing your filters.';
  renderGuide(byId.get(selectedId));
}

function openTrophy(id) {
  kind = 'all';
  $('search').value = '';
  $('grade-filter').value = 'all';
  $('status-filter').value = 'all';
  selectedId = id;
  renderFilters();
  showView('tracker');
  $('guide-title').focus({preventScroll: true});
  $('guide').scrollIntoView({block: 'nearest'});
}

function showView(next) {
  view = next;
  $('tracker').hidden = view !== 'tracker';
  $('roadmap').hidden = view !== 'roadmap';
  $('tracker-tab').setAttribute('aria-pressed', String(view === 'tracker'));
  $('roadmap-tab').setAttribute('aria-pressed', String(view === 'roadmap'));
  render();
}

function render() {
  refreshProgress();
  if (view === 'tracker') {
    $('roadmap').replaceChildren();
    renderTracker();
  } else {
    $('trophy-list').replaceChildren();
    $('guide').replaceChildren();
    renderRoadmap();
  }
}

function exportProgress() {
  const backup = {format: 'leonida-ledger', version: 1, earned: [...earned].sort((a, b) => a - b), hideStory};
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2) + '\n'], {type: 'application/json'}));
  const link = node('a');
  link.href = url;
  link.download = 'leonida-ledger-progress.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notice('Progress exported as a JSON backup.');
}

async function importProgress(event) {
  const input = event.currentTarget;
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  try {
    if (file.size > 64 * 1024) throw new Error('File is too large');
    const backup = JSON.parse(await file.text());
    const legacy = Array.isArray(backup);
    if (!legacy && (backup?.format !== 'leonida-ledger' || backup.version !== 1 || typeof backup.hideStory !== 'boolean')) {
      throw new Error('Unsupported backup format');
    }
    const nextEarned = normalizeEarned(legacy ? backup : backup.earned);
    earned = nextEarned;
    if (!legacy) hideStory = backup.hideStory;
    $('spoilers').checked = hideStory;
    if (persist()) notice(`Progress imported. ${earned.size} of ${trophies.length} earned.`);
    render();
  } catch {
    notice('Could not import this file. Choose a valid progress backup.');
  }
}

restore();
renderFilters();
$('tracker-tab').addEventListener('click', () => showView('tracker'));
$('roadmap-tab').addEventListener('click', () => showView('roadmap'));
$('search').addEventListener('input', renderTracker);
$('status-filter').addEventListener('change', renderTracker);
$('grade-filter').addEventListener('change', renderTracker);
$('spoilers').addEventListener('change', event => {
  hideStory = event.currentTarget.checked;
  persist();
  render();
});
$('export').addEventListener('click', exportProgress);
$('import-button').addEventListener('click', () => $('import').click());
$('import').addEventListener('change', importProgress);
render();
