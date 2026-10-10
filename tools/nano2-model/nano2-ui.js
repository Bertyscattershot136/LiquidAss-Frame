// A small 2006-style menu system for the nano's 176 x 132 LCD: nested lists the wheel scrolls
// through, the center button opens, MENU backs out of, plus a Now Playing screen.

const W = 176;
const H = 132;
const TITLE_H = 19;
const ROW_H = 17;
const ROWS = Math.floor((H - TITLE_H - 1) / ROW_H);   // 6 visible rows
const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

const SONGS = [
  { title: 'Peaches', artist: 'The Presidents', album: 'Peaches EP', len: 172 },
  { title: 'Cheek to Cheek', artist: 'Fred Astaire', album: 'Top Hat', len: 186 },
  { title: 'Bottoms Up', artist: 'The Tumblers', album: 'Glass Half Full', len: 214 },
  { title: 'Rear View', artist: 'Mirror Lake', album: 'Objects Appear', len: 199 },
  { title: 'Back That Up', artist: 'Reverse Beepers', album: 'Loading Zone', len: 231 },
  { title: 'Junk in the Trunk', artist: 'Hatchbacks', album: 'Cargo', len: 205 },
  { title: 'Tail End', artist: 'The Comets', album: 'Perihelion', len: 248 },
];

const list = (title, items) => ({ type: 'list', title, items });
const songItems = () => SONGS.map((s, i) => ({ label: s.title, song: i }));
const MENU_TREE = list('assPod', [
  {
    label: 'Music', open: () => list('Music', [
      { label: 'Playlists', open: () => list('Playlists', [{ label: 'On-The-Go', open: () => list('On-The-Go', songItems()) }, { label: 'Cheeky Classics', open: () => list('Cheeky Classics', songItems().slice(0, 4)) }]) },
      { label: 'Artists', open: () => list('Artists', SONGS.map((s, i) => ({ label: s.artist, open: () => list(s.artist, [{ label: s.title, song: i }]) }))) },
      { label: 'Albums', open: () => list('Albums', SONGS.map((s, i) => ({ label: s.album, open: () => list(s.album, [{ label: s.title, song: i }]) }))) },
      { label: 'Songs', open: () => list('Songs', songItems()) },
      { label: 'Genres', open: () => list('Genres', [{ label: 'Pop', open: () => list('Pop', songItems()) }]) },
      { label: 'Composers', open: () => list('Composers', [{ label: 'Unknown', open: () => list('Unknown', songItems()) }]) },
      { label: 'Audiobooks', open: () => list('Audiobooks', []) },
    ]),
  },
  { label: 'Photos', open: () => list('Photos', [{ label: 'Photo Library', open: () => list('Photo Library', []) }, { label: 'Slideshow Settings', open: () => list('Slideshow', []) }]) },
  {
    label: 'Extras', open: () => list('Extras', [
      { label: 'Clock', open: () => list('Clock', []) }, { label: 'Games', open: () => list('Games', [{ label: 'Brick' }, { label: 'Music Quiz' }, { label: 'Parachute' }, { label: 'Solitaire' }]) },
      { label: 'Contacts' }, { label: 'Calendar' }, { label: 'Notes' }, { label: 'Stopwatch' }, { label: 'Screen Lock' },
    ]),
  },
  {
    label: 'Settings', open: () => list('Settings', [
      { label: 'About' }, { label: 'Shuffle' }, { label: 'Repeat' }, { label: 'Volume Limit' }, { label: 'Backlight Timer' },
      { label: 'Brightness' }, { label: 'Audiobooks' }, { label: 'EQ' }, { label: 'Sound Check' }, { label: 'Clicker' },
    ]),
  },
  { label: 'Shuffle Songs', shuffle: true },
]);

export function createNanoUI(canvas, { scale = 4, onChange = () => {} } = {}) {
  canvas.width = W * scale;
  canvas.height = H * scale;
  const g = canvas.getContext('2d');
  const stack = [{ screen: MENU_TREE, sel: 0, top: 0 }];
  const player = { song: -1, playing: false, pos: 0 };
  let nowPlaying = false;
  const cur = () => stack[stack.length - 1];

  function play(i) {
    player.song = i;
    player.pos = 0;
    player.playing = true;
    nowPlaying = true;
  }

  function scroll(steps) {
    if (nowPlaying) return false;   // the wheel would set the volume; nothing to show for it here
    const c = cur();
    const n = c.screen.items.length;
    if (!n) return false;
    const sel = Math.max(0, Math.min(n - 1, c.sel + steps));
    if (sel === c.sel) return false;
    c.sel = sel;
    if (c.sel < c.top) c.top = c.sel;
    if (c.sel >= c.top + ROWS) c.top = c.sel - ROWS + 1;
    draw();
    return true;
  }

  function press(part) {
    if (part === 'menu') {
      if (nowPlaying) nowPlaying = false;
      else if (stack.length > 1) stack.pop();
    } else if (part === 'select') {
      if (nowPlaying) return;
      const item = cur().screen.items[cur().sel];
      if (!item) return;
      if (item.open) stack.push({ screen: item.open(), sel: 0, top: 0 });
      else if (item.song !== undefined) play(item.song);
      else if (item.shuffle) play(Math.floor(Math.random() * SONGS.length));
    } else if (part === 'play') {
      if (player.song < 0) play(0);
      else player.playing = !player.playing;
    } else if (part === 'next' || part === 'prev') {
      if (player.song < 0) return;
      if (part === 'prev' && player.pos > 3) player.pos = 0;
      else player.song = (player.song + (part === 'next' ? 1 : SONGS.length - 1)) % SONGS.length, player.pos = 0;
    }
    draw();
  }

  function tick(dt) {
    if (!player.playing) return;
    const before = Math.floor(player.pos);
    player.pos += dt;
    if (player.pos >= SONGS[player.song].len) { player.song = (player.song + 1) % SONGS.length; player.pos = 0; }
    if (nowPlaying && Math.floor(player.pos) !== before) draw();
  }

  // ---- drawing
  function titleBar(title) {
    const tb = g.createLinearGradient(0, 0, 0, TITLE_H);
    tb.addColorStop(0, '#fbfcfd');
    tb.addColorStop(1, '#c9ced6');
    g.fillStyle = tb;
    g.fillRect(0, 0, W, TITLE_H);
    g.fillStyle = '#8f96a1';
    g.fillRect(0, TITLE_H, W, 1);
    g.fillStyle = '#000';
    g.font = `700 12px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(fit(title, 110), W / 2, 10);
    if (player.song >= 0) {   // play / pause glyph, top left
      g.fillStyle = '#1f62c9';
      if (player.playing) {
        g.beginPath(); g.moveTo(6, 5); g.lineTo(13, 9.5); g.lineTo(6, 14); g.closePath(); g.fill();
      } else {
        g.fillRect(6, 5, 2.5, 9); g.fillRect(10.5, 5, 2.5, 9);
      }
    }
    g.fillStyle = '#4b4f55';
    g.fillRect(148, 5, 21, 10);
    g.fillRect(169, 8, 2, 4);
    const bat = g.createLinearGradient(0, 6, 0, 14);
    bat.addColorStop(0, '#b7f08a');
    bat.addColorStop(1, '#3fae1f');
    g.fillStyle = bat;
    g.fillRect(149, 6, 19, 8);
  }

  function fit(text, maxW) {
    if (g.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  function drawList() {
    const c = cur();
    const items = c.screen.items;
    titleBar(c.screen.title);
    const scrollbar = items.length > ROWS;
    const rowW = scrollbar ? W - 7 : W;
    g.font = `700 12px ${FONT}`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    for (let r = 0; r < ROWS; r++) {
      const i = c.top + r;
      const item = items[i];
      if (!item) break;
      const y = TITLE_H + 1 + r * ROW_H;
      const sel = i === c.sel;
      if (sel) {
        const hl = g.createLinearGradient(0, y, 0, y + ROW_H);
        hl.addColorStop(0, '#5aa4ee');
        hl.addColorStop(0.5, '#2b7fd9');
        hl.addColorStop(1, '#1561c4');
        g.fillStyle = hl;
        g.fillRect(0, y, rowW, ROW_H);
      }
      g.fillStyle = sel ? '#fff' : '#000';
      g.fillText(fit(item.label, rowW - 22), 5, y + ROW_H / 2 + 0.5);
      if (item.open) {
        g.strokeStyle = sel ? '#fff' : '#000';
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(rowW - 11, y + 5);
        g.lineTo(rowW - 7, y + 8.5);
        g.lineTo(rowW - 11, y + 12);
        g.stroke();
      }
    }
    if (!items.length) {
      g.fillStyle = '#7a7f87';
      g.textAlign = 'center';
      g.fillText('No items', W / 2, 70);
    }
    if (scrollbar) {
      const x = W - 6, top = TITLE_H + 2, h = H - top - 2;
      g.fillStyle = '#e3e6ea';
      g.fillRect(x, top, 5, h);
      g.strokeStyle = '#9aa1ab';
      g.lineWidth = 1;
      g.strokeRect(x + 0.5, top + 0.5, 4, h - 1);
      const th = Math.max(8, h * ROWS / items.length);
      const ty = top + (h - th) * (c.top / (items.length - ROWS));
      g.fillStyle = '#3d7fd6';
      g.fillRect(x + 1, ty + 1, 3, th - 2);
    }
  }

  function drawNowPlaying() {
    titleBar('Now Playing');
    const s = SONGS[player.song];
    g.fillStyle = '#000';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.font = `400 10px ${FONT}`;
    g.fillText(`${player.song + 1} of ${SONGS.length}`, 6, 30);
    g.textAlign = 'center';
    g.font = `700 12px ${FONT}`;
    g.fillText(fit(s.title, 164), W / 2, 52);
    g.font = `400 11px ${FONT}`;
    g.fillText(fit(s.artist, 164), W / 2, 68);
    g.fillText(fit(s.album, 164), W / 2, 83);
    // progress
    const x = 12, y = 102, w = W - 24, h = 7;
    g.fillStyle = '#fff';
    g.fillRect(x, y, w, h);
    g.strokeStyle = '#6d7480';
    g.lineWidth = 1;
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    const p = g.createLinearGradient(0, y, 0, y + h);
    p.addColorStop(0, '#7db7f2');
    p.addColorStop(1, '#2366c8');
    g.fillStyle = p;
    g.fillRect(x + 1, y + 1, (w - 2) * player.pos / s.len, h - 2);
    const t = (v) => `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, '0')}`;
    g.fillStyle = '#000';
    g.font = `400 10px ${FONT}`;
    g.textAlign = 'left';
    g.fillText(t(player.pos), x, 120);
    g.textAlign = 'right';
    g.fillText('-' + t(s.len - player.pos), x + w, 120);
  }

  function draw() {
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.fillStyle = '#fff';
    g.fillRect(0, 0, W, H);
    if (nowPlaying) drawNowPlaying(); else drawList();
    onChange();
  }

  draw();
  return { scroll, press, tick, draw };
}
