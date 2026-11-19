import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const executable = process.env.LEDGER_CHROMIUM ?? 'chromium';
const scratch = mkdtempSync(join(tmpdir(), 'ledger-browser-'));
const browser = spawn(executable, [
  '--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking',
  '--disable-gpu', '--remote-debugging-pipe', `--user-data-dir=${scratch}`,
], {stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe']});
const url = new URL('../app/index.html', import.meta.url).href;
const canonical = JSON.parse(readFileSync(new URL('../app/data/trophies.json', import.meta.url), 'utf8')).trophies;
const starterPath = process.env.LEDGER_OFFICIAL_LIST;
if (starterPath) {
  const official = JSON.parse(readFileSync(starterPath, 'utf8')).trophies;
  const officialFields = ({name, description, grade}) => ({name, description, grade});
  assert.deepEqual(canonical.map(officialFields), official.map(officialFields));
}

let sequence = 0;
let sessionId;
let buffer = '';
const pending = new Map();
const requests = [];
const exceptions = [];
function failPending(error) {
  for (const {reject} of pending.values()) reject(error);
  pending.clear();
}
browser.on('error', failPending);
browser.on('exit', code => failPending(new Error(`Chromium exited (${code})`)));
browser.stdio[4].setEncoding('utf8');
browser.stdio[4].on('data', chunk => {
  buffer += chunk;
  let end;
  while ((end = buffer.indexOf('\0')) !== -1) {
    const message = JSON.parse(buffer.slice(0, end));
    buffer = buffer.slice(end + 1);
    const waiter = pending.get(message.id);
    if (waiter) {
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
    }
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') exceptions.push(message.params.entry);
  }
});

function send(method, params = {}, target = sessionId) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, {resolve, reject});
    browser.stdio[3].write(JSON.stringify({id, method, params, ...(target && {sessionId: target})}) + '\0');
  });
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}

async function until(expression) {
  const end = Date.now() + 5000;
  while (Date.now() < end) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 35));
  }
  throw new Error(`Timed out: ${expression}`);
}

const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const text = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).textContent`);
const row = id => `[data-id="${id}"]`;
const listCount = () => evaluate('document.querySelectorAll("#trophy-list .entry").length');

async function screenshot(name) {
  if (!process.argv.includes('--capture')) return;
  const capture = await send('Page.captureScreenshot', {format: 'jpeg', quality: 88, fromSurface: true});
  const image = Buffer.from(capture.data, 'base64');
  assert.ok(image.length <= 256 * 1024, `${name} exceeds screenshot cap`);
  writeFileSync(new URL(`../screenshots/${name}.jpg`, import.meta.url), image);
}

try {
  const {targetId} = await send('Target.createTarget', {url: 'about:blank'});
  ({sessionId} = await send('Target.attachToTarget', {targetId, flatten: true}));
  await send('Page.enable');
  await send('Network.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.emulateNetworkConditions', {offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0});
  await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 800, deviceScaleFactor: 1, mobile: false});
  await send('Page.navigate', {url});
  await until('document.querySelectorAll(".entry").length === 55');
  assert.equal(canonical.length, 55);
  assert.equal(new Set(canonical.map(trophy => trophy.name)).size, 55);
  for (const {name, description, grade, guide, sources} of canonical) {
    for (const value of [name, description, grade, guide]) {
      assert.ok(typeof value === 'string' && value.trim(), name);
    }
    assert.ok(Array.isArray(sources) && sources.length > 0, name);
    for (const source of sources) {
      assert.ok(typeof source.name === 'string' && source.name.trim(), name);
      assert.ok(typeof source.url === 'string' && new URL(source.url).protocol === 'https:', name);
    }
  }
  assert.deepEqual(canonical.reduce((counts, trophy) => ({...counts, [trophy.grade]: (counts[trophy.grade] ?? 0) + 1}), {}),
    {platinum: 1, gold: 2, silver: 6, bronze: 46});

  const rendered = await evaluate(`Array.from(document.querySelectorAll('.entry'), row => {
    row.querySelector('.entry-open').click();
    return {
      name: row.querySelector('.entry-name').textContent,
      description: row.querySelector('.entry-description').textContent,
      grade: row.querySelector('.grade').textContent.toLowerCase(),
      guide: document.querySelector('.guidance').textContent,
      sources: Array.from(document.querySelectorAll('#guide .source a[href]'), link => ({
        name: link.textContent,
        url: link.href,
      })),
    };
  })`);
  assert.deepEqual(rendered, canonical.map(({name, description, grade, guide, sources}) =>
    ({name, description, grade, guide, sources})));

  for (const id of [3, 4, 8, 15, 18, 28, 44, 55]) await click(`${row(id)} .tick`);
  assert.equal(await text('#earned-count'), '8');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("leonida-ledger.v1")).earned.length'), 8);
  await send('Page.reload');
  await until('document.querySelector("#earned-count")?.textContent === "8"');
  assert.equal(await evaluate('document.querySelectorAll(".tick:checked").length'), 8);

  await send('Browser.setDownloadBehavior', {behavior: 'allow', downloadPath: scratch}, null);
  await click('#export');
  const backupPath = join(scratch, 'leonida-ledger-progress.json');
  let original;
  for (let attempt = 0; attempt < 60 && !original; attempt++) {
    try { original = JSON.parse(readFileSync(backupPath, 'utf8')); }
    catch { await new Promise(resolve => setTimeout(resolve, 35)); }
  }
  assert.deepEqual(original, {format: 'leonida-ledger', version: 1, earned: [3, 4, 8, 15, 18, 28, 44, 55], hideStory: false});
  await click(`${row(3)} .tick`);
  assert.equal(await text('#earned-count'), '7');
  const fileInput = await send('DOM.getDocument');
  const {nodeId} = await send('DOM.querySelector', {nodeId: fileInput.root.nodeId, selector: '#import'});
  await send('DOM.setFileInputFiles', {nodeId, files: [backupPath]});
  await until('document.querySelector("#earned-count").textContent === "8"');
  const badPath = join(scratch, 'invalid.json');
  writeFileSync(badPath, '[999]');
  await send('DOM.setFileInputFiles', {nodeId, files: [badPath]});
  await until('document.querySelector("#notice").textContent.startsWith("Could not import")');
  assert.equal(await text('#earned-count'), '8');
  await send('Page.reload');
  await until('document.querySelector("#earned-count")?.textContent === "8"');
  await screenshot('1-checklist');

  for (const kind of ['story', 'missable', 'collectibles', 'activities', 'online', 'side', 'finish']) {
    await click(`[data-kind="${kind}"]`);
    const count = canonical.filter(trophy => kind === 'missable' ? trophy.missable : trophy.kind === kind).length;
    assert.equal(await listCount(), count, kind);
  }
  await click('[data-kind="all"]');
  await evaluate('document.querySelector("#grade-filter").value = "silver"; document.querySelector("#grade-filter").dispatchEvent(new Event("change"))');
  assert.equal(await listCount(), 6);
  await click(`${row(17)} .entry-open`);
  assert.equal(await text('#guide-title'), 'The Shootist');
  assert.ok(await evaluate(`(() => {
    const link = document.querySelector('#guide .source a[href]');
    if (!link) return false;
    const {top, bottom, width} = link.getBoundingClientRect();
    return width > 0 && top >= 0 && bottom <= innerHeight;
  })()`));
  await screenshot('2-silver');
  await evaluate('document.querySelector("#grade-filter").value = "all"; document.querySelector("#status-filter").value = "earned"; document.querySelector("#status-filter").dispatchEvent(new Event("change"))');
  assert.equal(await listCount(), 8);
  await evaluate('document.querySelector("#status-filter").value = "all"; const searchTest = document.querySelector("#search"); searchTest.value = "Ocean Beach"; searchTest.dispatchEvent(new Event("input"))');
  assert.equal(await listCount(), 1);
  await evaluate('document.querySelector("#search").value = ""');
  await click('#roadmap-tab');
  assert.equal(await evaluate('document.querySelectorAll(".route-item").length'), 55);
  assert.equal(await evaluate('document.querySelectorAll(".route-card").length'), 4);
  await screenshot('3-roadmap');
  await click('#spoilers');
  assert.equal(await evaluate('document.querySelector("#roadmap").innerText.includes("Gone Fishing")'), false);
  assert.equal(await evaluate('document.querySelector("#roadmap").innerText.includes("Complete Chapter 1.")'), true);
  await click('#tracker-tab');
  await click('[data-kind="story"]');
  assert.equal(await text(`${row(2)} .entry-name`), 'Hidden story trophy #2');
  assert.equal(await text(`${row(3)} .entry-name`), 'Paradise Lost');
  await click(`${row(2)} .entry-open`);
  assert.equal(await text('#guide-title'), 'Hidden story trophy #2');
  assert.equal(await evaluate('document.querySelector("#guide").innerText.includes("Gone Fishing")'), false);
  assert.equal(await evaluate('document.querySelector("#guide .source")'), null);
  await screenshot('4-spoilers');
  await click('#guide-toggle');
  assert.equal(await text('#guide-title'), 'Just Like Paradise');
  await send('Page.reload');
  await until('document.querySelector("#spoilers")?.checked === true');
  assert.equal(await text('#earned-count'), '9');
  assert.equal(await text(`${row(2)} .entry-name`), 'Just Like Paradise');
  assert.deepEqual(requests.filter(request => /^(?:https?|wss?):/i.test(request)), []);
  assert.deepEqual(exceptions, []);
  console.log('Chromium passed: 55 exact trophies and cited guides, offline file loads, persistence, export/import, invalid backup, filters, search, roadmap, and spoilers.');
  console.log(`Observed ${requests.length} local resource loads, zero network requests, zero page exceptions.`);
} finally {
  browser.kill();
}
