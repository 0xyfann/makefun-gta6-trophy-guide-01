const roadmapStages = [
  {title: 'Advance the story', summary: 'Verify each chapter and named mission as it completes. Keep rotating saves before potential missables.', groups: [
    {title: 'Chapter checkpoints', ids: [3, 4, 5, 6, 7]},
    {title: 'Named missions · order unverified', ids: [2, 8, 9, 10, 11, 12, 13]},
    {title: 'Ambiguous story clues', ids: [47, 48, 49, 50]},
  ]},
  {title: 'Finish stranger strands', summary: 'Follow local leads alongside the story. Check any unfinished strands before moving into a new chapter.', groups: [
    {title: '8 completed strands · eligible roster unverified', ids: [25, 22, 23, 24, 26, 27, 29]},
  ]},
  {title: 'Sweep Leonida', summary: 'Record locations as you pass through. Group card sets, races and challenges into focused sweeps.', groups: [
    {title: 'Collectibles & exploration', ids: [28, 30, 31, 35, 42, 54, 55]},
    {title: 'Activities & challenges', ids: [15, 16, 17, 18, 19, 20, 21, 32, 33, 34, 36, 37, 38, 39, 40, 41, 43, 44, 45, 46, 51, 52, 53]},
  ]},
  {title: 'Audit completion & platinum', summary: 'Use the in-game completion figure for the gold. Then check all 54 other unlocks on PS5 before marking platinum.', groups: [
    {title: 'Final checks', ids: [14, 1]},
  ]},
];

function roadmapItem(id, showMissions) {
  const trophy = byId.get(id);
  const masked = concealed(trophy);
  const item = node('li', 'route-item');
  const button = node('button', masked ? 'masked' : '', showMissions && !masked ? trophy.description : trophyName(trophy));
  button.type = 'button';
  button.addEventListener('click', () => openTrophy(id));
  if (earned.has(id)) button.prepend(node('span', 'route-done', '✓ '));
  if (trophy.target && !masked) {
    const amount = trophy.target.toLocaleString('en-US');
    button.append(node('span', 'route-target', trophy.unit === '% completion' ? `${amount}% completion` : `${amount} ${trophy.unit}`));
  }
  if (trophy.missable) button.append(node('span', 'route-risk', 'Potential missable'));
  item.append(button);
  return item;
}

function renderRoadmap() {
  const heading = node('div', 'roadmap-head');
  const copy = node('div');
  copy.append(node('p', 'label', 'RECOMMENDED ORDER'), node('h2', '', 'Road to platinum'),
    node('p', '', 'Based on the official PS5 trophy descriptions and the counts in the competition kit.'));
  const caution = node('p', 'route-caution');
  caution.append(node('strong', '', 'Potential missables'),
    document.createTextNode(' mark save checkpoints. The list does not confirm permanent lockouts.'));
  heading.append(copy, caution);
  const grid = node('div', 'route-grid');
  for (const [index, stage] of roadmapStages.entries()) {
    const card = node('article', 'route-card');
    const ids = stage.groups.flatMap(group => group.ids);
    const top = node('div', 'route-top');
    top.append(node('span', 'label', `STEP ${index + 1}`),
      node('span', '', `${ids.filter(id => earned.has(id)).length}/${ids.length} earned`));
    card.append(top, node('h3', '', stage.title), node('p', 'route-summary', stage.summary));
    for (const group of stage.groups) {
      const section = node('div', 'route-group');
      const list = node('ul');
      list.append(...group.ids.map(id => roadmapItem(id, index === 0 && group !== stage.groups[2])));
      section.append(node('h4', '', group.title), list);
      card.append(section);
    }
    grid.append(card);
  }
  $('roadmap').replaceChildren(heading, grid);
}
