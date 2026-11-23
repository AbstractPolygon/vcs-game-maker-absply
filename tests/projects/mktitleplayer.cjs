// usage: node tests/projects/mktitleplayer.cjs -> tests/projects/titleplayer_<single|mixed>.vcsgm from p6_ball2.vcsgm (Bricks, DPC+): its title page has a Player sprites
// card (both players the Torches animation, 12 rows, Scanlines per pixel row 2). single: Torches set to 1 line (the Player editor's toggle): the card draws a line a
// row, the torches half as tall as in p6_ball2. mixed: the same, and Player 1 shows Bonus (2 lines a row): its rows are kept twice, so it looks as Bonus does on a
// card of 2 lines a row (p6_ball2 with Player 1 set to Bonus). Frame 120 with emulator/framepng.cjs.
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const dir = __dirname;
[['single', false], ['mixed', true]].forEach(([key, mixed]) => {
  const doc = yaml.load(fs.readFileSync(path.join(dir, 'p6_ball2.vcsgm'), 'utf8'));
  doc.configuration.projectTitle = `Title player ${key}`;
  doc['player-animations'].animations[1].singleHeight = true;
  if (mixed) doc['title-screen'].screens.forEach((screen) => screen.cards.filter((card) => card.type === 'player').forEach((card) => { card.player1Animation = '2'; }));
  fs.writeFileSync(path.join(dir, `titleplayer_${key}.vcsgm`), yaml.dump(doc, {lineWidth: -1}));
});
console.log('ok');
