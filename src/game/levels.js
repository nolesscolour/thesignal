/* Level data. Everything level-specific lives here; Signal.jsx reads it.
   Coordinates are world pixels. Lists are copied fresh on every run start,
   so the game can mutate its copies (parts taken, mines fired) safely. */

const FIRST_LIGHT = {
  id: 1,
  num: '01',
  name: 'FIRST LIGHT',
  W: 840,
  H: 3400,
  spawn: { x: 420, y: 3320 },
  maxAmmo: 40,
  /* Checkpoints in the order the player reaches them (each triggers when the player goes north of triggerY). */
  checkpoints: [
    { x: 598, y: 1537, triggerY: 1560, respawn: { x: 600, y: 1555 } },
  ],
  tower: { x: 418, y: 80 },
  treeSeed: 9917,
  groundSeed: 4451,
  treeCount: 210,
  radio: {
    start: 'copy. three parts. then the tower. moving north.',
    checkpoint: 'checkpoint. progress saved. we hold this position.',
    allParts: 'that is all three. get to the tower. make it speak.',
    fixing: 'patching the tower. hold them off.',
  },
  walls: [
    { x: 0,   y: 2950, w: 330, h: 26 },
    { x: 510, y: 2950, w: 330, h: 26 },
    { x: 400, y: 2250, w: 30,  h: 500 },
    { x: 430, y: 2250, w: 410, h: 26 },
    { x: 0,   y: 2250, w: 170, h: 26 },
    { x: 300, y: 1950, w: 540, h: 26 },
    { x: 0,   y: 1600, w: 540, h: 26 },
    { x: 400, y: 950,  w: 30,  h: 500 },
    { x: 0,   y: 950,  w: 400, h: 26 },
    { x: 200, y: 600,  w: 420, h: 26 },
  ],
  enemies: [
    { p1: { x: 350, y: 3040 }, p2: { x: 490, y: 3040 } },
    { p1: { x: 100, y: 2500 }, p2: { x: 360, y: 2500 } },
    { p1: { x: 610, y: 2360 }, p2: { x: 610, y: 2650 } },
    { p1: { x: 60,  y: 2100 }, p2: { x: 340, y: 2100 } },
    { p1: { x: 80,  y: 1700 }, p2: { x: 520, y: 1700 } },
    { p1: { x: 640, y: 1420 }, p2: { x: 640, y: 1080 } },
    { p1: { x: 110, y: 1200 }, p2: { x: 330, y: 1200 } },
    { p1: { x: 250, y: 810 },  p2: { x: 590, y: 810 } },
    { p1: { x: 120, y: 450 },  p2: { x: 300, y: 450 } },
    { p1: { x: 540, y: 450 },  p2: { x: 720, y: 450 } },
    { p1: { x: 330, y: 1875 }, p2: { x: 545, y: 1875 } },
    { p1: { x: 645, y: 660 },  p2: { x: 645, y: 845 } },
    { p1: { x: 285, y: 2210 }, p2: { x: 285, y: 2210 }, f0: Math.PI / 2 },
    { p1: { x: 150, y: 1915 }, p2: { x: 150, y: 1915 }, f0: Math.PI / 2 },
    { p1: { x: 690, y: 1565 }, p2: { x: 690, y: 1565 }, f0: Math.PI / 2 },
    { p1: { x: 100, y: 565 },  p2: { x: 100, y: 565 },  f0: Math.PI / 2 },
    { p1: { x: 730, y: 565 },  p2: { x: 730, y: 565 },  f0: Math.PI / 2 },
    { p1: { x: 700, y: 2050 }, p2: { x: 700, y: 2050 }, h: 1 },
    { p1: { x: 620, y: 1500 }, p2: { x: 620, y: 1500 }, h: 1 },
    { p1: { x: 180, y: 870 },  p2: { x: 180, y: 870 },  h: 1 },
    { p1: { x: 660, y: 700 },  p2: { x: 660, y: 700 },  h: 1 },
    { p1: { x: 420, y: 385 },  p2: { x: 420, y: 385 },  h: 1 },
    { p1: { x: 800, y: 1740 }, p2: { x: 800, y: 1740 }, sn: 1, f0: Math.PI },
    { p1: { x: 60,  y: 1180 }, p2: { x: 60,  y: 1180 }, sn: 1, f0: 0 },
    { p1: { x: 418, y: 130 },  p2: { x: 418, y: 130 },  sn: 1, f0: Math.PI / 2 },
    { p1: { x: 560, y: 300 },  p2: { x: 700, y: 300 } },
    { p1: { x: 760, y: 2295 }, p2: { x: 760, y: 2295 }, f0: Math.PI / 2 },
    { p1: { x: 150, y: 1035 }, p2: { x: 150, y: 1035 }, f0: Math.PI },
    { p1: { x: 365, y: 745 },  p2: { x: 365, y: 745 },  f0: 0 },
    { p1: { x: 640, y: 1610 }, p2: { x: 640, y: 1610 }, h: 1 },
    { p1: { x: 700, y: 1500 }, p2: { x: 700, y: 1500 }, f0: Math.PI / 2 },
    { p1: { x: 330, y: 900 },  p2: { x: 330, y: 900 },  h: 1 },
    { p1: { x: 550, y: 860 },  p2: { x: 550, y: 860 },  h: 1 },
    { p1: { x: 240, y: 520 },  p2: { x: 240, y: 520 },  h: 1 },
    { p1: { x: 600, y: 380 },  p2: { x: 600, y: 380 },  h: 1 },
    { p1: { x: 320, y: 300 },  p2: { x: 320, y: 300 },  h: 1 },
    { p1: { x: 740, y: 340 },  p2: { x: 740, y: 340 },  h: 1 },
    { p1: { x: 790, y: 900 },  p2: { x: 790, y: 900 },  sn: 1, f0: Math.PI },
    { p1: { x: 60,  y: 300 },  p2: { x: 60,  y: 300 },  sn: 1, f0: 0 },
    { p1: { x: 470, y: 540 },  p2: { x: 470, y: 540 },  h: 1, ru: 1 },
    { p1: { x: 180, y: 380 },  p2: { x: 180, y: 380 },  h: 1, ru: 1 },
    { p1: { x: 250, y: 700 },  p2: { x: 120, y: 760 },  ru: 1 },
    { p1: { x: 500, y: 180 },  p2: { x: 650, y: 240 },  ru: 1 },
    { p1: { x: 240, y: 500 },  p2: { x: 420, y: 500 } },
    { p1: { x: 100, y: 150 },  p2: { x: 300, y: 150 } },
    { p1: { x: 700, y: 140 },  p2: { x: 560, y: 90 } },
    { p1: { x: 500, y: 1150 }, p2: { x: 700, y: 1150 } },
    { p1: { x: 480, y: 1350 }, p2: { x: 760, y: 1420 } },
    { p1: { x: 520, y: 1080 }, p2: { x: 520, y: 1080 }, h: 1 },
    { p1: { x: 700, y: 1300 }, p2: { x: 700, y: 1300 }, h: 1 },
    { p1: { x: 470, y: 1010 }, p2: { x: 470, y: 1010 }, f0: Math.PI / 2 },
    { p1: { x: 60,  y: 1750 }, p2: { x: 60,  y: 1750 }, sn: 1, f0: 0 },
    { p1: { x: 600, y: 1850 }, p2: { x: 750, y: 1850 } },
    { p1: { x: 350, y: 1700 }, p2: { x: 350, y: 1700 }, h: 1 },
    { p1: { x: 150, y: 1450 }, p2: { x: 320, y: 1500 }, ru: 1 },
    { p1: { x: 620, y: 2680 }, p2: { x: 620, y: 2680 }, f0: Math.PI },
  ],
  trips: [
    { x1: 332, y1: 2890, x2: 440, y2: 2890, done: false },
    { x1: 30,  y1: 1965, x2: 270, y2: 1965, done: false },
    { x1: 560, y1: 1615, x2: 810, y2: 1615, done: false },
  ],
  mines: [
    { x: 600, y: 2350 }, { x: 700, y: 2430 }, { x: 520, y: 2550 },
    { x: 150, y: 1050 }, { x: 240, y: 1130 }, { x: 90,  y: 1180 },
    { x: 300, y: 480 },  { x: 385, y: 520 },  { x: 470, y: 420 },
    { x: 545, y: 490 },  { x: 350, y: 360 },  { x: 500, y: 330 },
  ],
  meds: [
    { x: 760, y: 2320, taken: false },
    { x: 90,  y: 1010, taken: false },
    { x: 420, y: 700,  taken: false },
  ],
  ammo: [
    { x: 120, y: 2740, amt: 8, taken: false },
    { x: 420, y: 2050, amt: 8, taken: false },
    { x: 150, y: 1560, amt: 8, taken: false },
    { x: 640, y: 1180, amt: 8, taken: false },
    { x: 250, y: 820,  amt: 8, taken: false },
  ],
  lakes: [
    { x: 430, y: 1790, r: 62 },
    { x: 140, y: 2670, r: 45 },
    { x: 740, y: 760,  r: 55 },
  ],
  quicksand: [
    { x: 480, y: 2450, r: 40 },
    { x: 250, y: 1300, r: 45 },
    { x: 420, y: 250,  r: 50 },
    { x: 350, y: 3120, r: 40 },
  ],
  fires: [
    { x: 620, y: 2120, r: 13 },
    { x: 600, y: 1250, r: 13 },
    { x: 140, y: 680,  r: 13 },
    { x: 550, y: 3050, r: 13 },
  ],
  radioTriggers: [
    { x: 0,   y: 2740, w: 840, h: 60,  line: 'trees are all dead. how long has it been.', done: false },
    { x: 460, y: 2280, w: 380, h: 160, line: 'dead end. double back. — another way.', done: false },
    { x: 0,   y: 1380, w: 840, h: 60,  line: 'coordinates hold. come home.', done: false },
    { x: 0,   y: 980,  w: 370, h: 150, line: 'not this way. static—', done: false },
    { x: 0,   y: 240,  w: 840, h: 60,  line: 'first light. still walking.', done: false },
  ],
  parts: [
    { x: 690, y: 2790, dur: 3,   name: 'MAST',  line: 'antenna mast secured. two more. keep north.' },
    { x: 430, y: 1660, dur: 4,   name: 'CELL',  line: 'power cell secured. one left.' },
    { x: 760, y: 470,  dur: 5,   name: 'VALVE', line: 'valve secured. now the tower. make it speak.' },
  ],
  bushes: [
    { x: 150, y: 3250, r: 22 }, { x: 690, y: 3060, r: 20 }, { x: 90,  y: 2860, r: 19 }, { x: 560, y: 2740, r: 22 },
    { x: 740, y: 2520, r: 20 }, { x: 120, y: 2380, r: 22 }, { x: 460, y: 2140, r: 19 }, { x: 680, y: 1900, r: 22 },
    { x: 230, y: 1770, r: 20 }, { x: 90,  y: 1500, r: 20 }, { x: 560, y: 1230, r: 21 }, { x: 200, y: 1020, r: 20 },
    { x: 700, y: 880,  r: 19 }, { x: 350, y: 640,  r: 18 }, { x: 620, y: 520,  r: 20 }, { x: 150, y: 240,  r: 20 },
    { x: 600, y: 180,  r: 19 },
  ],
};

/* ---------------------------------------------------------------------------
   LEVEL 2 — THE RUINS
   Sewer approach (y 3400–4300) added below the surface. The surface is still
   the placeholder (Level 1's layout on a new seed) until chunk 3.
   Sewer route is a serpentine: start bottom-right, rows alternate direction,
   ladder out through the gap in the top wall (x 690–750).
--------------------------------------------------------------------------- */
const SEWER = {
  zone: { x: 0, y: 3400, w: 840, h: 900 },
  speed: 0.7,                       // wading: 70% of normal speed
  exit: { x: 720, y: 3380 },        // ladder top; the objective pointer aims here while underground
  walls: [
    { x: 0,   y: 3400, w: 690, h: 26 },   // ceiling, left of ladder
    { x: 750, y: 3400, w: 90,  h: 26 },   // ceiling, right of ladder
    { x: 120, y: 3540, w: 720, h: 26 },   // bar 1 (gap left)
    { x: 0,   y: 3680, w: 720, h: 26 },   // bar 2 (gap right)
    { x: 120, y: 3820, w: 720, h: 26 },   // bar 3 (gap left)
    { x: 0,   y: 3960, w: 720, h: 26 },   // bar 4 (gap right)
    { x: 120, y: 4100, w: 720, h: 26 },   // bar 5 (gap left)
    { x: 430, y: 4126, w: 26,  h: 90 },   // row 6 squeeze
    { x: 300, y: 4030, w: 26,  h: 70 },   // row 5 squeeze
    { x: 480, y: 3846, w: 26,  h: 70 },   // row 4 squeeze
    { x: 560, y: 3900, w: 120, h: 20 },   // row 4 dead-end pocket (roof)
    { x: 560, y: 3920, w: 20,  h: 40 },   // row 4 dead-end pocket (back wall)
    { x: 280, y: 3750, w: 26,  h: 70 },   // row 3 squeeze
    { x: 460, y: 3566, w: 26,  h: 70 },   // row 2 squeeze
    { x: 360, y: 3470, w: 26,  h: 70 },   // row 1 squeeze
  ],
  /* Short, disconnected currents. dx/dy = push direction, push = px/sec. */
  channels: [
    { x: 340, y: 4022, w: 320, h: 42, dx: 1,  dy: 0, push: 120 },  // row 5: carries you toward a mine
    { x: 150, y: 3870, w: 280, h: 40, dx: 1,  dy: 0, push: 110 },  // row 4: pushes the wrong way, use the lower lane
    { x: 420, y: 3640, w: 280, h: 36, dx: -1, dy: 0, push: 120 },  // row 2: shortcut through the squeeze
  ],
  trips: [
    { x1: 250, y1: 4126, x2: 250, y2: 4206 },
    { x1: 300, y1: 3846, x2: 300, y2: 3916 },
    { x1: 250, y1: 3610, x2: 250, y2: 3680 },
  ],
  mines: [
    { x: 560, y: 4043 }, { x: 200, y: 4060 },
    { x: 500, y: 3740 }, { x: 600, y: 3790 }, { x: 420, y: 3765 },
    { x: 520, y: 3500 }, { x: 600, y: 3460 },
  ],
  fires: [
    { x: 380, y: 3790, r: 13 },
    { x: 200, y: 3500, r: 13 },
  ],
  meds: [{ x: 630, y: 3940 }],            // reward in the row 4 dead end
  ammo: [{ x: 800, y: 3480, amt: 8 }],    // reward in the pocket past the ladder
};

/* Wall-shell helper for ruined buildings. Each side is solid unless a gap
   [offset, length] is given, measured from the left (n/s) or top (e/w). */
const T = 12;
function room(x, y, w, h, gaps = {}) {
  const out = [];
  const side = (gap, len, make) => {
    if (!gap) { make(0, len); return; }
    const [o, g] = gap;
    if (o > 0) make(0, o);
    if (o + g < len) make(o + g, len - (o + g));
  };
  side(gaps.n, w, (o, l) => out.push({ x: x + o, y, w: l, h: T }));
  side(gaps.s, w, (o, l) => out.push({ x: x + o, y: y + h - T, w: l, h: T }));
  side(gaps.w, h, (o, l) => out.push({ x, y: y + o, w: T, h: l }));
  side(gaps.e, h, (o, l) => out.push({ x: x + w - T, y: y + o, w: T, h: l }));
  return out;
}

/* ---- Surface: outskirts (y 2500–3400) ---- */
const OUTSKIRTS = {
  walls: [
    ...room(560, 3050, 160, 120, { s: [60, 40] }),                 // H1 near the ladder
    ...room(60, 2600, 240, 200, { n: [150, 40] }),                 // H2: MAST house, door on the far (north) side
    { x: 60, y: 2700, w: 170, h: T },                              // H2 inner partition: go down the right side
    ...room(380, 2700, 140, 110, { w: [40, 36], e: [40, 36] }),    // H3 walk-through
    ...room(600, 2560, 180, 140, { w: [50, 40] }),                 // H4: ammo inside
    { x: 300, y: 3200, w: 60, h: T }, { x: 450, y: 2930, w: T, h: 70 }, { x: 170, y: 3110, w: 70, h: T },   // rubble
  ],
  enemies: [
    { p1: { x: 300, y: 3150 }, p2: { x: 520, y: 3150 } },
    { p1: { x: 335, y: 2880 }, p2: { x: 335, y: 2630 } },
    { p1: { x: 560, y: 2520 }, p2: { x: 780, y: 2520 } },
    { p1: { x: 480, y: 2960 }, p2: { x: 480, y: 2960 }, f0: Math.PI / 2 },
    { p1: { x: 720, y: 2800 }, p2: { x: 720, y: 2800 }, h: 1 },
    { p1: { x: 260, y: 2560 }, p2: { x: 260, y: 2560 }, f0: 0 },
  ],
  trips: [{ x1: 520, y1: 3320, x2: 640, y2: 3320 }, { x1: 214, y1: 2560, x2: 214, y2: 2596 }],
  mines: [{ x: 400, y: 3050 }, { x: 560, y: 2880 }, { x: 130, y: 2880 }],
  fires: [{ x: 540, y: 3250, r: 13 }],
  quicksand: [{ x: 250, y: 3290, r: 35 }],
  bushes: [{ x: 680, y: 3230, r: 20 }, { x: 420, y: 3120, r: 19 }, { x: 330, y: 2980, r: 20 }, { x: 560, y: 2650, r: 18 }, { x: 760, y: 2950, r: 20 }],
  meds: [],
  ammo: [{ x: 690, y: 2630, amt: 8 }],
};

/* ---- Surface: forest ring + village square (y 1300–2500) ---- */
const SQUARE = {
  walls: [
    ...room(320, 1700, 200, 240, { n: [80, 40] }),                 // church: only door faces north
    { x: 340, y: 1770, w: 60, h: 10 }, { x: 440, y: 1770, w: 60, h: 10 },   // pews (aisle down the middle)
    { x: 340, y: 1820, w: 60, h: 10 }, { x: 440, y: 1820, w: 60, h: 10 },
    ...room(160, 1580, 120, 100, { s: [40, 36] }),
    ...room(560, 2080, 130, 110, { n: [46, 36] }),                 // med inside
    { x: 200, y: 2050, w: 70, h: 34 }, { x: 590, y: 1600, w: 60, h: 30 },   // burned vehicles
    { x: 690, y: 1474, w: 20, h: 14 },                             // watchtower base
  ],
  enemies: [
    { p1: { x: 290, y: 1660 }, p2: { x: 550, y: 1660 } },          // church north (door side)
    { p1: { x: 290, y: 1990 }, p2: { x: 550, y: 1990 } },          // church south
    { p1: { x: 285, y: 1720 }, p2: { x: 285, y: 1950 } },          // church west
    { p1: { x: 380, y: 1880 }, p2: { x: 380, y: 1880 }, h: 1 },    // waiting in the pews
    { p1: { x: 200, y: 2350 }, p2: { x: 200, y: 2350 }, h: 1, ru: 1 },
    { p1: { x: 640, y: 1350 }, p2: { x: 640, y: 1350 }, h: 1, ru: 1 },
  ],
  trips: [{ x1: 120, y1: 2240, x2: 240, y2: 2240 }],
  mines: [{ x: 600, y: 1760 }, { x: 240, y: 1820 }],
  fires: [{ x: 235, y: 2040, r: 13 }],
  lakes: [{ x: 430, y: 2150, r: 22 }],                             // the village well
  bushes: [{ x: 600, y: 1880, r: 20 }, { x: 240, y: 1930, r: 19 }, { x: 470, y: 2240, r: 20 }, { x: 150, y: 1720, r: 18 }, { x: 700, y: 1700, r: 19 }],
  meds: [{ x: 625, y: 2140 }],
  ammo: [{ x: 150, y: 2400, amt: 8 }],
};

/* ---- Surface: north ridge (y 60–1300) ---- */
const RIDGE = {
  walls: [
    { x: 600, y: 540, w: 180, h: T },                              // bunker top
    { x: 600, y: 540, w: T, h: 172 },                              // bunker left
    { x: 768, y: 540, w: T, h: 172 },                              // bunker right
    { x: 600, y: 700, w: 120, h: T },                              // bunker bottom, entry gap bottom-right
    { x: 612, y: 600, w: 120, h: T },                              // inner baffle: up the right side, then back left
    { x: 120, y: 1150, w: 120, h: T }, { x: 470, y: 1180, w: T, h: 60 }, { x: 220, y: 380, w: 80, h: T },   // ridge rubble
  ],
  enemies: [
    { p1: { x: 100, y: 900 }, p2: { x: 100, y: 900 }, sn: 1, f0: 0 },
    { p1: { x: 780, y: 1100 }, p2: { x: 780, y: 1100 }, sn: 1, f0: Math.PI },
    { p1: { x: 420, y: 300 }, p2: { x: 420, y: 300 }, sn: 1, f0: Math.PI / 2 },
    { p1: { x: 200, y: 1000 }, p2: { x: 500, y: 1000 } },
    { p1: { x: 330, y: 760 }, p2: { x: 330, y: 470 } },
    { p1: { x: 480, y: 460 }, p2: { x: 760, y: 460 } },
    { p1: { x: 300, y: 200 }, p2: { x: 300, y: 200 }, h: 1, ru: 1 },
    { p1: { x: 560, y: 220 }, p2: { x: 560, y: 220 }, h: 1, ru: 1 },
    { p1: { x: 690, y: 800 }, p2: { x: 690, y: 800 }, f0: -Math.PI / 2 },   // watches the bunker approach
  ],
  trips: [{ x1: 520, y1: 760, x2: 620, y2: 760 }],
  mines: [{ x: 350, y: 860 }, { x: 480, y: 640 }, { x: 160, y: 620 }],
  fires: [{ x: 600, y: 1050, r: 13 }],
  bushes: [{ x: 250, y: 1100, r: 20 }, { x: 560, y: 900, r: 20 }, { x: 140, y: 760, r: 19 }, { x: 420, y: 560, r: 18 }, { x: 650, y: 330, r: 19 }, { x: 200, y: 260, r: 20 }],
  meds: [{ x: 150, y: 500 }],
  ammo: [{ x: 250, y: 760, amt: 8 }, { x: 700, y: 660, amt: 8 }],
};

const THE_RUINS = {
  id: 2,
  num: '02',
  name: 'THE RUINS',
  W: 840,
  H: 4300,
  maxAmmo: 45,
  spawn: { x: 740, y: 4200 },
  tower: { x: 418, y: 80 },
  checkpoints: [
    { x: 730, y: 3352, triggerY: 3396, respawn: { x: 720, y: 3370 }, line: 'topside. checkpoint saved.' },
    { x: 640, y: 2262, triggerY: 2280, respawn: { x: 640, y: 2292 }, line: 'the square. checkpoint saved.' },
    { x: 560, y: 1232, triggerY: 1250, respawn: { x: 560, y: 1262 }, line: 'the ridge. checkpoint saved.' },
  ],
  treeSeed: 5521,
  groundSeed: 7313,
  treeCount: 300,
  /* Tree density by band (keep = chance a candidate tree survives), plus open ground with no trees. */
  treeZones: [
    { y0: 2500, y1: 3400, keep: 0.3 },     // outskirts: thin
    { y0: 1300, y1: 2500, keep: 1 },       // forest ring around the square: dense
    { y0: 0,    y1: 1300, keep: 0.35 },    // ridge: open
  ],
  noTrees: [
    { x: 150, y: 1560, w: 560, h: 700 },   // the village square clearing
    { x: 590, y: 530, w: 200, h: 190 },    // bunker
  ],
  /* Watchtower: a red beam sweeps the square along `path` (ping-pong). Standing in it
     fills an exposure meter; full = the tower fires and raises the alarm. Brush hides
     you. The lamp can be shot out (hp hits), but gunfire carries. */
  spotlights: [
    {
      tower: { x: 700, y: 1480 },
      path: [{ x: 190, y: 1620 }, { x: 230, y: 2200 }, { x: 650, y: 2210 }],
      speed: 70,          // px/sec along the path
      radius: 26,
      hp: 3,
    },
  ],
  briefing: {
    label: 'SECTOR 02 // THE RUINS',
    line: 'THE SECOND RELAY STANDS ABOVE A DEAD VILLAGE.',
    body: [
      { t: 'THE ROAD IN IS GONE. THE SEWERS ARE NOT.' },
      { t: 'NO SHOOTING DOWN THERE. PING TO SEE.' },
      { t: 'A WATCHTOWER LIGHT SWEEPS THE SQUARE.' },
      { t: 'STAY OUT OF THE RED.', red: true },
    ],
  },
  sewer: SEWER,
  walls: [...OUTSKIRTS.walls, ...SQUARE.walls, ...RIDGE.walls],
  enemies: [...OUTSKIRTS.enemies, ...SQUARE.enemies, ...RIDGE.enemies],
  trips: [...OUTSKIRTS.trips, ...SQUARE.trips, ...RIDGE.trips, ...SEWER.trips],
  mines: [...OUTSKIRTS.mines, ...SQUARE.mines, ...RIDGE.mines, ...SEWER.mines],
  fires: [...OUTSKIRTS.fires, ...SQUARE.fires, ...RIDGE.fires, ...SEWER.fires],
  quicksand: [...OUTSKIRTS.quicksand],
  lakes: [...SQUARE.lakes],
  bushes: [...OUTSKIRTS.bushes, ...SQUARE.bushes, ...RIDGE.bushes],
  meds: [...OUTSKIRTS.meds, ...SQUARE.meds, ...RIDGE.meds, ...SEWER.meds],
  ammo: [...OUTSKIRTS.ammo, ...SQUARE.ammo, ...RIDGE.ammo, ...SEWER.ammo],
  radioTriggers: [
    { x: 0, y: 2440, w: 840, h: 50, line: 'the trees took the village. keep low.' },
    { x: 0, y: 2200, w: 840, h: 50, line: 'church ahead. the cell will be inside.' },
    { x: 0, y: 1290, w: 840, h: 50, line: 'high ground. snipers. stay in cover.' },
    { x: 0, y: 240,  w: 840, h: 50, line: 'relay two. make it speak.' },
  ],
  parts: [
    { x: 130, y: 2750, dur: 3, name: 'MAST',  line: 'mast secured. the village next.' },
    { x: 420, y: 1890, dur: 4, name: 'CELL',  line: 'cell secured. north, to the ridge.' },
    { x: 650, y: 570,  dur: 5, name: 'VALVE', line: 'valve secured. relay two. get to it.' },
  ],
  radio: {
    start: 'sewers under the ruins. no shooting down here. find the ladder.',
    checkpoint: 'checkpoint saved.',
    allParts: 'that is all three. get to the relay. make it speak.',
    fixing: 'patching relay two. hold them off.',
  },
};

export const LEVELS = [FIRST_LIGHT, THE_RUINS];

/* Named on the level map but not built yet. */
export const PLANNED = [
  { num: '03', name: 'THE PACK' },
  { num: '04', name: 'THE FOG' },
  { num: '05', name: "SNIPER'S MILE" },
  { num: '06', name: 'THE SIGNAL' },
];

export const levelById = (id) => LEVELS.find((l) => l.id === id) || LEVELS[0];