import { useGame } from '../store/useGame'
import { audio } from './sfx'

/**
 * Background music, synthesised live with WebAudio (no files to download). Every page has its own
 * song, and each song is built from a few sections (verse, chorus, a break with a drum fill), so it
 * plays for about a minute before it comes round again. It ducks while the brawlers are talking.
 */
export type Track =
  | 'menu'
  | 'home'
  | 'workshop'
  | 'gallery'
  | 'showroom'
  | 'characters'
  | 'shop'
  | 'inventory'
  | 'anthem'
  | 'rankings'
  | 'clans'
  | 'pass'
  | 'faceoff'
  // one of the battle songs, a different one from the last battle
  | 'battle'

type SongId = Exclude<Track, 'battle'> | 'clash' | 'storm' | 'rally'
const BATTLE: SongId[] = ['clash', 'storm', 'rally']

type Quality = 'maj' | 'min' | 'maj7' | 'min7' | '7'
/** Chord root as a MIDI note, and its quality. */
type Chord = [number, Quality]

/**
 * One bar of 16 steps (16th notes), or a list of bars that take turns. '.' is a rest, '-' holds the
 * note before. Drums: 'x' hit, 'o' soft hit, 'O' open hi-hat; toms 'h' 'm' 'l'. Bass and arpeggio: a
 * chord tone (0 root, 1 third, 2 fifth, 3 the next one up …). Melody: a step of the song's scale
 * (0–9, then a–e an octave up), so it always stays in key.
 */
type Pattern = string | string[]
type Row = 'kick' | 'snare' | 'hat' | 'tom' | 'bass' | 'arp' | 'lead'
type Pad = 'decay' | 'hold' | false

type Parts = { [K in Row]?: Pattern } & {
  /** 'decay' strikes the chord each bar, 'hold' keeps it sounding into the next one. */
  pad?: Pad
  arpWave?: OscillatorType
  leadWave?: OscillatorType
}

type Section = Parts & {
  /** One chord per bar. */
  chords: Chord[]
  /** A drum fill in the last bar (a random one, or the one named); the next section opens with a crash. */
  fill?: boolean | FillName
  /** A rising noise sweep over the last bar. */
  riser?: boolean
}

type Song = Parts & {
  bpm: number
  /** Melody step 0 as a MIDI note, and the scale the melody walks. */
  key: number
  scale: 'major' | 'minor'
  sections: Record<string, Section>
  /** The order the sections play in, round and round. */
  form: string[]
  /** Echo on the melody and arpeggio, 0–0.5. */
  echo?: number
  /** Pushes every second 16th late by this part of a step, for a swung groove. */
  swing?: number
  padWave?: OscillatorType
  /** Volume trim so every song plays at about the same level. */
  gain?: number
}

interface Fill {
  kick: string
  snare: string
  tom: string
}
const FILLS = {
  snap: { kick: 'x.......x.......', snare: '....x.......oxxx', tom: '' },
  toms: { kick: 'x.......x.......', snare: '....x...........', tom: '........h.h.m.l.' },
  shuffle: { kick: 'x.....x.x.......', snare: '....x...x..xx.xx', tom: '' },
  roll: { kick: 'x.......x.......', snare: 'x.x.x.x.xxxxxxxx', tom: '' },
} satisfies Record<string, Fill>
type FillName = keyof typeof FILLS
const RANDOM_FILLS: Fill[] = [FILLS.snap, FILLS.toms, FILLS.shuffle]

// chord loops shared by a song's sections
const AM_F_C_G: Chord[] = [
  [57, 'min'],
  [53, 'maj'],
  [48, 'maj'],
  [55, 'maj'],
]
const G_EM_C_D: Chord[] = [
  [55, 'maj'],
  [52, 'min'],
  [48, 'maj'],
  [50, 'maj'],
]
const F_DM_BB_C: Chord[] = [
  [53, 'maj'],
  [50, 'min'],
  [46, 'maj'],
  [48, 'maj'],
]
const DM_F_C_AM: Chord[] = [
  [50, 'min'],
  [53, 'maj'],
  [48, 'maj'],
  [45, 'min'],
]
const D_A_BM_G: Chord[] = [
  [50, 'maj'],
  [57, 'maj'],
  [47, 'min'],
  [55, 'maj'],
]
const C_AM_F_G: Chord[] = [
  [48, 'maj'],
  [45, 'min'],
  [53, 'maj'],
  [55, 'maj'],
]
const A_FSM_D_E: Chord[] = [
  [57, 'maj7'],
  [54, 'min7'],
  [50, 'maj7'],
  [52, '7'],
]
const BB_F_GM_EB: Chord[] = [
  [46, 'maj'],
  [53, 'maj'],
  [55, 'min'],
  [51, 'maj'],
]
const BM_G_D_A: Chord[] = [
  [47, 'min'],
  [55, 'maj'],
  [50, 'maj'],
  [57, 'maj'],
]
const E_B_CSM_A: Chord[] = [
  [52, 'maj'],
  [47, 'maj'],
  [49, 'min'],
  [57, 'maj'],
]
const EM_EM_C_B: Chord[] = [
  [52, 'min'],
  [52, 'min'],
  [48, 'maj'],
  [47, 'maj'],
]
const DM_BB_C_DM: Chord[] = [
  [50, 'min'],
  [46, 'maj'],
  [48, 'maj'],
  [50, 'min'],
]
const CM_CM_AB_BB: Chord[] = [
  [48, 'min'],
  [48, 'min'],
  [44, 'maj'],
  [46, 'maj'],
]
const GM_EB_BB_F: Chord[] = [
  [55, 'min'],
  [51, 'maj'],
  [46, 'maj'],
  [53, 'maj'],
]

const SHOP_A: Section = {
  chords: C_AM_F_G,
  lead: ['4.7.9..b..9.7...', '5.7.9..c..9.7...', '5.7.a..c..a.7...', '6.8.b..d..b.8...'],
}

const SONGS: Record<SongId, Song> = {
  // the attribute wheel: calm and inviting, in A minor
  menu: {
    bpm: 88,
    key: 69,
    scale: 'minor',
    kick: 'x.......x.......',
    hat: '..x...x...x...x.',
    bass: '0.....0.2...0...',
    arp: '0.1.2.0.1.2.0.1.',
    pad: 'decay',
    leadWave: 'triangle',
    echo: 0.2,
    sections: {
      open: { chords: AM_F_C_G, kick: '' },
      A: { chords: AM_F_C_G },
      B: { chords: AM_F_C_G, lead: ['4-----3-2---0---', '5-----4-2-------', '4-----2-6---4---', '3-------1-------'] },
      C: {
        chords: [
          [53, 'maj'],
          [55, 'maj'],
          [52, 'min'],
          [57, 'min'],
        ],
        lead: ['7---5---2-------', '6---3---1-------', '4---6---8---6---', '7-------4-------'],
      },
    },
    form: ['open', 'A', 'B', 'C', 'A', 'B', 'C'],
  },
  // the attribute pages and the 3D viewer: a light adventure theme in G
  home: {
    bpm: 104,
    key: 67,
    scale: 'major',
    kick: 'x.........x.....',
    snare: '........x.......',
    hat: '..x...x...x...x.',
    bass: '0..2....0..3..2.',
    arp: '0.1.2.0.1.2.0.1.',
    arpWave: 'sine',
    pad: 'decay',
    leadWave: 'triangle',
    echo: 0.15,
    sections: {
      open: { chords: G_EM_C_D },
      A: { chords: G_EM_C_D, lead: ['2-4-7-----9-7-4-', '5-----4-2-------', '3-5-7---5-3-0---', '4-------6-4-1---'] },
      B: {
        chords: [
          [48, 'maj'],
          [50, 'maj'],
          [47, 'min'],
          [52, 'min'],
        ],
        lead: ['7---7-5-3-------', '6---6-4-8-------', '6---4---2---4---', '5-------------4-'],
        fill: true,
      },
      C: {
        chords: [
          [52, 'min'],
          [48, 'maj'],
          [55, 'maj'],
          [50, 'maj'],
        ],
        kick: '',
        snare: '',
        arp: '0.1.2.3.2.1.0.1.',
        fill: 'toms',
      },
    },
    form: ['open', 'A', 'B', 'C', 'A', 'B'],
  },
  // creating or editing a brawler: playful, with a little swing, in F
  workshop: {
    bpm: 100,
    key: 65,
    scale: 'major',
    swing: 0.12,
    kick: 'x.......x.x.....',
    snare: '....x.......x...',
    hat: 'o.o.o.o.o.o.o.o.',
    bass: '0...2...3.2.0...',
    arp: '0.1.2.1.0.1.2.1.',
    pad: 'decay',
    leadWave: 'square',
    echo: 0.2,
    sections: {
      open: { chords: F_DM_BB_C, snare: '' },
      A: { chords: F_DM_BB_C, lead: ['4-2-4-7---4-2---', '5---7-5-2-------', '3-5-7---5-3-0---', '4-------6---8---'] },
      B: {
        chords: [
          [46, 'maj'],
          [48, 'maj'],
          [45, 'min'],
          [50, 'min'],
        ],
        lead: ['7---5---3---5---', '8---6---4---6---', '6---4---2---4-6-', '7-------5-------'],
      },
      C: {
        chords: [
          [55, 'min'],
          [48, 'maj'],
          [53, 'maj'],
          [53, 'maj'],
        ],
        lead: ['5---3---1---3---', '4---6---8---6---', '7---------------', ''],
        fill: true,
      },
    },
    form: ['open', 'A', 'B', 'A', 'C'],
  },
  // the encyclopedia: slow and spacious, for reading, in D minor
  gallery: {
    bpm: 72,
    key: 62,
    scale: 'minor',
    hat: '....o.......o...',
    bass: '0-------2-------',
    arp: '0.....2.....4...',
    arpWave: 'sine',
    pad: 'hold',
    leadWave: 'sine',
    echo: 0.35,
    sections: {
      A: { chords: DM_F_C_AM },
      B: {
        chords: [
          [46, 'maj'],
          [53, 'maj'],
          [48, 'maj'],
          [50, 'min'],
        ],
        lead: ['9-------7-------', 'b-------9-------', 'a-------8---6---', '7---------------'],
      },
      C: {
        chords: [
          [55, 'min'],
          [46, 'maj'],
          [53, 'maj'],
          [57, 'maj'],
        ],
        lead: ['a-------c-------', '9-------7-------', 'b-------9-------', 'b-------8-------'],
      },
    },
    form: ['A', 'A', 'B', 'A', 'C'],
  },
  // the Bakugan showroom: calm and glassy, for looking around, in E-flat
  showroom: {
    bpm: 80,
    key: 63,
    scale: 'major',
    kick: 'x...............',
    hat: '..o...o...o...o.',
    bass: '0-------2-------',
    arp: '0..1..2..3..2..1',
    arpWave: 'sine',
    pad: 'hold',
    padWave: 'triangle',
    leadWave: 'triangle',
    echo: 0.35,
    sections: {
      A: {
        chords: [
          [51, 'maj'],
          [56, 'maj7'],
          [48, 'min7'],
          [46, 'maj'],
        ],
      },
      B: {
        chords: [
          [56, 'maj7'],
          [46, 'maj'],
          [55, 'min'],
          [48, 'min7'],
        ],
        lead: ['9-------7-------', '8-------b-------', '9-------6-------', '7---------------'],
      },
      C: {
        chords: [
          [53, 'min7'],
          [46, 'maj'],
          [51, 'maj'],
          [51, 'maj'],
        ],
        lead: ['8-------a-------', 'b-------8-------', '7---------------', ''],
      },
    },
    form: ['A', 'A', 'B', 'A', 'C'],
  },
  // the brawler showroom: warm, like a story about friends, in D
  characters: {
    bpm: 84,
    key: 62,
    scale: 'major',
    kick: 'x.......x.......',
    snare: '....o.......o...',
    hat: '..o...o...o...o.',
    bass: '0.....2.3.....2.',
    arp: '0.2.1.2.0.2.1.2.',
    pad: 'hold',
    leadWave: 'triangle',
    echo: 0.25,
    sections: {
      open: { chords: D_A_BM_G },
      A: { chords: D_A_BM_G, lead: ['9---7---4-----7-', '8-----6-4-------', '9---7---5---7---', 'a-----9-7-------'] },
      B: {
        chords: [
          [55, 'maj'],
          [57, 'maj'],
          [54, 'min'],
          [47, 'min'],
        ],
        lead: ['7---a---c-------', 'b---8---6-------', 'b---9---6-------', 'c-------9-------'],
      },
      C: {
        chords: [
          [52, 'min'],
          [57, 'maj'],
          [50, 'maj'],
          [50, 'maj'],
        ],
        lead: ['8---a---c---a---', 'b---8---6---4---', '7---------------', ''],
      },
    },
    form: ['open', 'A', 'B', 'open', 'A', 'C'],
  },
  // the shop: a bouncy groove in C
  shop: {
    bpm: 112,
    key: 60,
    scale: 'major',
    kick: 'x.....x.x.......',
    snare: '....x.......x...',
    hat: '..x...x...x...x.',
    bass: '0..0..3.2..0..3.',
    pad: false,
    leadWave: 'triangle',
    echo: 0.12,
    sections: {
      A: SHOP_A,
      A2: { ...SHOP_A, arp: '0.1.2.0.1.2.0.1.' },
      B: {
        chords: [
          [53, 'maj'],
          [55, 'maj'],
          [52, 'min'],
          [57, 'min'],
        ],
        lead: ['c---c-a-7---a---', 'b---b-8-6---8---', '9-b-9-6-4-------', '7-------9---c---'],
        fill: true,
      },
      C: {
        chords: C_AM_F_G,
        snare: '',
        hat: 'x.x.x.x.x.x.x.x.',
        arp: '0.1.2.3.2.1.2.1.',
        pad: 'decay',
        fill: 'snap',
        riser: true,
      },
      D: {
        chords: [
          [50, 'min'],
          [55, 'maj'],
          [48, 'maj'],
          [57, 'min'],
        ],
        lead: ['8---a---c---a---', 'b---8---6---8---', '9---7---4-------', '5-------7---9---'],
        fill: true,
      },
    },
    form: ['A', 'B', 'C', 'A2', 'D', 'B'],
  },
  // the inventory: laid back and swung, with seventh chords, in A
  inventory: {
    bpm: 90,
    key: 57,
    scale: 'major',
    swing: 0.18,
    kick: 'x......x..x.....',
    snare: '....x.......x..o',
    hat: 'x.o.x.o.x.o.x.o.',
    bass: '0......2..3.....',
    pad: 'hold',
    padWave: 'triangle',
    leadWave: 'triangle',
    echo: 0.25,
    sections: {
      open: { chords: A_FSM_D_E },
      A: { chords: A_FSM_D_E, lead: ['9-b-d---b-------', 'c-----b-9-------', 'a-c-e---c-------', 'b-------d---8---'] },
      B: {
        chords: [
          [47, 'min7'],
          [52, '7'],
          [49, 'min7'],
          [54, 'min7'],
        ],
        lead: ['a-------8---7---', 'b-------d---a---', '9-------b---d---', 'c---------------'],
        arp: '0...1...2...3...',
        arpWave: 'sine',
      },
      C: {
        chords: [
          [50, 'maj7'],
          [52, '7'],
          [57, 'maj7'],
          [57, 'maj7'],
        ],
        lead: ['a---c---e---c---', 'b---d---b---8---', '7---------------', ''],
        fill: 'snap',
      },
    },
    form: ['open', 'A', 'B', 'open', 'A', 'C'],
  },
  // the player profile: a proud anthem in B-flat
  anthem: {
    bpm: 94,
    key: 58,
    scale: 'major',
    kick: 'x.......x.......',
    snare: '....x.......x...',
    hat: 'x...x...x...x...',
    bass: '0...0...2...3...',
    pad: 'decay',
    leadWave: 'sawtooth',
    echo: 0.15,
    sections: {
      open: { chords: BB_F_GM_EB },
      A: { chords: BB_F_GM_EB, lead: ['7---9---b-------', 'b---8---6-------', '9---7---5---7---', 'a-------c-------'] },
      B: {
        chords: [
          [51, 'maj'],
          [53, 'maj'],
          [50, 'min'],
          [55, 'min'],
        ],
        lead: ['c---c-b-a---7---', 'b---b-a-8---6---', '9---b---d-------', 'c-------9-------'],
      },
      C: {
        chords: [
          [48, 'min'],
          [53, 'maj'],
          [46, 'maj'],
          [46, 'maj'],
        ],
        lead: ['8---a---c---a---', 'b---d---b---8---', 'e---------------', ''],
        fill: true,
      },
    },
    form: ['open', 'A', 'B', 'open', 'A', 'C'],
  },
  // the rankings: a stately march in A-flat
  rankings: {
    bpm: 98,
    key: 56,
    scale: 'major',
    kick: 'x.......x.......',
    snare: '....x..o....x.oo',
    hat: 'x...x...x...x...',
    bass: '0...2...3...2...',
    pad: 'decay',
    leadWave: 'square',
    echo: 0.15,
    sections: {
      open: {
        chords: [
          [56, 'maj'],
          [53, 'min'],
          [49, 'maj'],
          [51, 'maj'],
        ],
      },
      A: {
        chords: [
          [56, 'maj'],
          [53, 'min'],
          [49, 'maj'],
          [51, 'maj'],
        ],
        lead: ['7---7-9-b---7---', 'c-----b-9---7---', 'a---c---e-------', 'd---b---8-------'],
      },
      B: {
        chords: [
          [49, 'maj'],
          [51, 'maj'],
          [48, 'min'],
          [53, 'min'],
        ],
        lead: ['7---a---c-------', '8---b---d-------', '9---b---d---b---', 'c-------9-------'],
        arp: '0.1.2.1.0.1.2.1.',
      },
      C: {
        chords: [
          [46, 'min'],
          [51, 'maj'],
          [56, 'maj'],
          [56, 'maj'],
        ],
        lead: ['c---a---8---a---', 'b---d---b---8---', '7---------------', ''],
        fill: true,
      },
    },
    form: ['open', 'A', 'B', 'open', 'A', 'C'],
  },
  // the clans: a tribal, all-together chant in B minor
  clans: {
    bpm: 100,
    key: 59,
    scale: 'minor',
    kick: 'x.....x...x.....',
    snare: '....x.......x...',
    hat: '..x...x...x...x.',
    tom: '..........m...l.',
    bass: '0.....0...2.3...',
    pad: 'decay',
    leadWave: 'square',
    echo: 0.2,
    gain: 0.89,
    sections: {
      open: { chords: BM_G_D_A, snare: '', tom: '..h...m...h.m.l.' },
      A: { chords: BM_G_D_A, lead: ['b-----e-b-9-7---', 'c-----b-9-------', '9---b---d---b---', 'd-------a---8---'] },
      B: {
        chords: [
          [55, 'maj'],
          [57, 'maj'],
          [47, 'min'],
          [47, 'min'],
        ],
        lead: ['7-7-9---7---5---', '8-8-a---8---6---', '9-9-b---9---7---', '7---------------'],
      },
      C: {
        chords: [
          [47, 'min'],
          [47, 'min'],
          [55, 'maj'],
          [57, 'maj'],
        ],
        pad: false,
        kick: 'x...x...x...x...',
        tom: 'h.h.m.m.l.l.m.h.',
        fill: true,
      },
    },
    form: ['open', 'A', 'B', 'A', 'C', 'B'],
  },
  // the Season Pass: a celebration, four on the floor, in E
  pass: {
    bpm: 118,
    key: 52,
    scale: 'major',
    kick: 'x...x...x...x...',
    snare: '....x.......x...',
    hat: 'x.O.x.O.x.O.x.O.',
    bass: '0.3.0.3.0.3.0.3.',
    pad: 'decay',
    leadWave: 'square',
    echo: 0.15,
    gain: 0.89,
    sections: {
      A: { chords: E_B_CSM_A, lead: ['7-7-9-b---9-7---', '8-8-b-d---b-8---', '9-9-c-e---c-9---', 'a---c---e-------'] },
      B: {
        chords: [
          [57, 'maj'],
          [47, 'maj'],
          [56, 'min'],
          [49, 'min'],
        ],
        lead: ['e---e-d-c---a---', 'd---d-c-b---8---', '9---b---d---b---', 'c-------9-------'],
        arp: '0.1.2.3.0.1.2.3.',
      },
      C: {
        chords: [
          [57, 'maj'],
          [47, 'maj'],
          [52, 'maj'],
          [52, 'maj'],
        ],
        lead: ['a---c---e---c---', 'b---d---b---8---', '7---------------', ''],
        fill: true,
        riser: true,
      },
      // the drop: drums out, arpeggio and a held chord
      D: { chords: E_B_CSM_A, kick: '', snare: '', hat: '..o...o...o...o.', arp: '0.1.2.1.0.1.2.1.', pad: 'hold', fill: true },
    },
    form: ['A', 'B', 'C', 'D', 'A', 'B', 'C'],
  },
  // team face-off: tense, a pulse building up to the brawl
  faceoff: {
    bpm: 120,
    key: 52,
    scale: 'minor',
    kick: 'x...x...x...x...',
    hat: '..x...x...x...x.',
    bass: '0.0.0.0.0.0.0.0.',
    arp: '0..1..0..1..0...',
    pad: 'decay',
    leadWave: 'sawtooth',
    sections: {
      A: { chords: EM_EM_C_B },
      B: {
        chords: [
          [57, 'min'],
          [52, 'min'],
          [48, 'maj'],
          [47, 'maj'],
        ],
        lead: ['c-------a-------', 'b-------9-------', 'c-------e-------', 'b-------8-------'],
      },
      // the build: the snare doubles up, then rolls into the top
      C: {
        chords: EM_EM_C_B,
        snare: ['....x.......x...', '....x.......x...', 'x...x...x...x...', 'x...x...x...x...'],
        hat: 'x.x.x.x.x.x.x.x.',
        fill: 'roll',
        riser: true,
      },
    },
    form: ['A', 'B', 'A', 'B', 'C'],
  },
  // battle 1: driving, in D minor
  clash: {
    bpm: 132,
    key: 62,
    scale: 'minor',
    kick: 'x...x...x...x...',
    snare: '....x.......x...',
    hat: 'x.x.x.x.x.x.x.xx',
    bass: '0.0.0.3.0.0.2.3.',
    pad: 'decay',
    leadWave: 'square',
    sections: {
      open: { chords: DM_BB_C_DM },
      A: { chords: DM_BB_C_DM, lead: ['7--9--b-9-7-4---', '9--7--5-7-9-c---', '8--6--3-6-8-a---', '7-------4---7---'] },
      B: {
        chords: [
          [55, 'min'],
          [50, 'min'],
          [46, 'maj'],
          [57, 'maj'],
        ],
        lead: ['a---a-c-a---7---', '9---9-b-9---7---', '7---7-9-c---9---', 'b-------8---4---'],
        fill: true,
      },
      // the break: drums drop out, then roll back in
      C: { chords: DM_BB_C_DM, kick: '', snare: '', hat: 'oooooooooooooooo', fill: 'roll', riser: true },
      D: {
        chords: [
          [46, 'maj'],
          [48, 'maj'],
          [50, 'min'],
          [50, 'min'],
        ],
        lead: ['c-------9-------', 'a-------8-------', '7---9---b-------', 'b---------------'],
        fill: true,
      },
    },
    form: ['open', 'A', 'B', 'C', 'A', 'D', 'B'],
  },
  // battle 2: fast and fierce, in C minor
  storm: {
    bpm: 144,
    key: 60,
    scale: 'minor',
    kick: 'x.....x.x.....x.',
    snare: '....x.......x...',
    hat: 'xoxoxoxoxoxoxoxo',
    bass: '0.0.0.0.0.0.3.2.',
    pad: 'decay',
    leadWave: 'sawtooth',
    gain: 0.95,
    sections: {
      open: { chords: CM_CM_AB_BB },
      A: { chords: CM_CM_AB_BB, lead: ['7-7-9-7-b---9-7-', '7-7-9-7-4-------', '5-5-7-5-9---7-5-', '6-6-8-6-a---8---'] },
      B: {
        chords: [
          [53, 'min'],
          [48, 'min'],
          [44, 'maj'],
          [55, 'maj'],
        ],
        lead: ['a---c---a-7-5---', '9---b---9-7-4---', '7---9---c-------', 'b-------8---4---'],
        arp: '0.1.2.1.0.1.2.1.',
        arpWave: 'square',
        fill: true,
      },
      // the break: half-time kick, then a roll and a sweep back into the top
      C: {
        chords: [
          [48, 'min'],
          [48, 'min'],
          [44, 'maj'],
          [55, 'maj'],
        ],
        kick: ['x.......x.......', 'x.......x.......', 'x...x...x...x...', 'x...x...x...x...'],
        snare: '',
        fill: 'roll',
        riser: true,
      },
      D: {
        chords: [
          [51, 'maj'],
          [46, 'maj'],
          [44, 'maj'],
          [55, 'maj'],
        ],
        lead: ['9---b---d---b---', 'a---8---6---8---', '9---7---5---7---', '8-------4-------'],
        fill: true,
      },
    },
    form: ['open', 'A', 'B', 'D', 'A', 'C', 'B'],
  },
  // battle 3: heroic, galloping, in G minor
  rally: {
    bpm: 126,
    key: 55,
    scale: 'minor',
    kick: 'x.......x.x.....',
    snare: '....x.......x...',
    hat: 'x.x.x.x.x.x.x.x.',
    bass: '0..0..0.0..0..3.',
    pad: 'decay',
    leadWave: 'square',
    echo: 0.1,
    gain: 1.08,
    sections: {
      open: { chords: GM_EB_BB_F },
      A: { chords: GM_EB_BB_F, lead: ['b---b-9-7---9-b-', 'c---c-b-9---7---', '9---b---d---b---', 'd-------a---8---'] },
      B: {
        chords: [
          [51, 'maj'],
          [53, 'maj'],
          [46, 'maj'],
          [50, 'maj'],
        ],
        lead: ['e---e-d-c---9---', 'd---d-c-a---8---', 'b---d---9---b---', 'b-------8---4---'],
        arp: '0.1.2.3.2.1.0.1.',
        fill: true,
      },
      C: {
        chords: [
          [55, 'min'],
          [55, 'min'],
          [51, 'maj'],
          [50, 'maj'],
        ],
        kick: 'x.......x.......',
        snare: '',
        tom: '..........m...l.',
        fill: 'toms',
        riser: true,
      },
      D: {
        chords: [
          [48, 'min'],
          [55, 'min'],
          [51, 'maj'],
          [50, 'maj'],
        ],
        lead: ['a---c---e-------', 'b---9---7-------', 'c---9---7---9---', 'b---------------'],
        fill: true,
      },
    },
    form: ['open', 'A', 'B', 'D', 'A', 'C', 'B'],
  },
}

const LOOKAHEAD = 0.3
const TICK_MS = 50
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] }
const SHAPES: Record<Quality, number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  '7': [0, 4, 7, 10],
}
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)
/** Chord tone n counted upwards: 0 root, 1 third, 2 fifth, then on into the next octave. */
const chordTone = (notes: number[], n: number) => notes[n % notes.length] + 12 * Math.floor(n / notes.length)
/** '0'–'9' and 'a'–'e' as numbers; NaN for a rest or a hold. */
const digit = (c: string) => parseInt(c, 36)
/** How many steps the note at step i lasts: itself plus the holds after it. */
function held(row: string, i: number) {
  let k = i + 1
  while (row[k] === '-') k++
  return k - i
}

interface Bar {
  sec: Section
  chord: Chord
  /** Bar number inside its section. */
  n: number
  last: boolean
}
const plans = new Map<Song, Bar[]>()
/** Bar b of the song, going round the form. */
function barAt(song: Song, b: number): Bar {
  let bars = plans.get(song)
  if (!bars) {
    bars = song.form.flatMap((name) => {
      const sec = song.sections[name]
      return sec.chords.map((chord, n) => ({ sec, chord, n, last: n === sec.chords.length - 1 }))
    })
    plans.set(song, bars)
  }
  return bars[b % bars.length]
}

/** The song now playing, on its own bus so it can fade out cleanly when the page changes. */
interface Playing {
  song: Song
  bus: GainNode
  echo: GainNode | null
  vibrato: GainNode
  lfo: OscillatorNode
  nodes: AudioNode[]
  step: number
  nextTime: number
  level: number
  quietSince: number
  fill: Fill
}

let current: Track | null = null
let playing: Playing | null = null
let lastBattle: SongId | null = null
let master: DynamicsCompressorNode | null = null
let timer = 0
let noiseBuffer: AudioBuffer | null = null

function start(song: Song): Playing {
  const a = audio()
  if (!master) {
    master = a.createDynamicsCompressor()
    master.connect(a.destination)
  }
  const bus = a.createGain()
  bus.gain.value = 0
  bus.connect(master)
  const nodes: AudioNode[] = [bus]
  let echo: GainNode | null = null
  if (song.echo) {
    // a dotted-eighth echo that darkens as it repeats
    echo = a.createGain()
    echo.gain.value = song.echo
    const delay = a.createDelay(1)
    delay.delayTime.value = Math.min(0.9, (60 / song.bpm) * 0.75)
    const tone = a.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 2500
    const back = a.createGain()
    back.gain.value = 0.32
    echo.connect(delay).connect(tone).connect(back).connect(delay)
    tone.connect(bus)
    nodes.push(echo, delay, tone, back)
  }
  // a gentle vibrato for long melody notes
  const lfo = a.createOscillator()
  lfo.frequency.value = 5.5
  const vibrato = a.createGain()
  vibrato.gain.value = 7
  lfo.connect(vibrato)
  lfo.start()
  nodes.push(lfo, vibrato)
  return {
    song,
    bus,
    echo,
    vibrato,
    lfo,
    nodes,
    step: 0,
    nextTime: a.currentTime + 0.1,
    level: -1,
    quietSince: 0,
    fill: FILLS.snap,
  }
}

/** Fades a song out and then drops it, together with every note already scheduled on it. */
function retire(p: Playing) {
  const a = audio()
  const now = a.currentTime
  const g = p.bus.gain
  if (typeof g.cancelAndHoldAtTime === 'function') g.cancelAndHoldAtTime(now)
  else {
    g.cancelScheduledValues(now)
    g.setValueAtTime(g.value, now)
  }
  g.setTargetAtTime(0, now, 0.3)
  p.lfo.stop(now + 3)
  window.setTimeout(() => p.nodes.forEach((n) => n.disconnect()), 3200)
}

interface Note {
  wave: OscillatorType
  freq: number
  at: number
  dur: number
  gain: number
  cutoff: number
  attack?: number
  /** Holds the note (fading a little) and then lets it ring out for this long, instead of a pluck. */
  release?: number
  detune?: number
  echo?: boolean
  vibrato?: boolean
}

function voice(p: Playing, v: Note) {
  const a = audio()
  const osc = a.createOscillator()
  const f = a.createBiquadFilter()
  const g = a.createGain()
  osc.type = v.wave
  osc.frequency.value = v.freq
  if (v.detune) osc.detune.value = v.detune
  f.type = 'lowpass'
  f.frequency.value = v.cutoff
  const attack = v.attack ?? 0.01
  const end = Math.max(v.at + v.dur, v.at + attack + 0.02)
  g.gain.setValueAtTime(0.0001, v.at)
  g.gain.exponentialRampToValueAtTime(v.gain, v.at + attack)
  let stop = end
  if (v.release) {
    g.gain.exponentialRampToValueAtTime(v.gain * 0.6, end)
    g.gain.exponentialRampToValueAtTime(0.0001, end + v.release)
    stop = end + v.release
  } else g.gain.exponentialRampToValueAtTime(0.0001, end)
  osc.connect(f).connect(g).connect(p.bus)
  if (v.echo && p.echo) g.connect(p.echo)
  if (v.vibrato) {
    p.vibrato.connect(osc.detune)
    osc.onended = () => {
      try {
        p.vibrato.disconnect(osc.detune)
      } catch {
        // already let go with the rest of the song
      }
    }
  }
  osc.start(v.at)
  osc.stop(stop + 0.05)
}

/** Two seconds of white noise, shared by every drum hit. */
function noise(a: BaseAudioContext) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== a.sampleRate) {
    noiseBuffer = a.createBuffer(1, a.sampleRate * 2, a.sampleRate)
    const d = noiseBuffer.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noiseBuffer
}

function hiss(p: Playing, type: BiquadFilterType, freq: number, at: number, len: number, gain: number) {
  const a = audio()
  const src = a.createBufferSource()
  src.buffer = noise(a)
  const f = a.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  const g = a.createGain()
  g.gain.setValueAtTime(gain, at)
  g.gain.exponentialRampToValueAtTime(0.0001, at + len)
  src.connect(f).connect(g).connect(p.bus)
  src.start(at, Math.random() * 1.5, len + 0.02)
}

/** A pitched drum that drops in pitch: the kick, or a tom. */
function thump(p: Playing, at: number, from: number, to: number, len: number, gain: number) {
  const a = audio()
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.frequency.setValueAtTime(from, at)
  osc.frequency.exponentialRampToValueAtTime(to, at + len * 0.7)
  g.gain.setValueAtTime(gain, at)
  g.gain.exponentialRampToValueAtTime(0.0001, at + len)
  osc.connect(g).connect(p.bus)
  osc.start(at)
  osc.stop(at + len + 0.05)
}

const TOMS: Record<string, number> = { h: 210, m: 155, l: 110 }

function drum(p: Playing, kind: Row, c: string, at: number, vel: number) {
  if (c === '.' || c === '-' || c === '') return
  const v = (c === 'o' ? 0.5 : 1) * vel
  if (kind === 'kick') thump(p, at, 140, 40, 0.25, 0.9 * v)
  else if (kind === 'snare') hiss(p, 'bandpass', 1800, at, 0.18, 0.5 * v)
  else if (kind === 'hat') {
    if (c === 'O') hiss(p, 'highpass', 7000, at, 0.22, 0.12 * vel)
    else hiss(p, 'highpass', 7000, at, 0.05, 0.18 * v)
  } else if (kind === 'tom' && TOMS[c]) thump(p, at, TOMS[c], TOMS[c] * 0.6, 0.3, 0.45 * vel)
}

/** Filtered noise that rises over a bar, into the next section. */
function riser(p: Playing, at: number, dur: number) {
  const a = audio()
  const src = a.createBufferSource()
  src.buffer = noise(a)
  src.loop = true
  const f = a.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = 3
  f.frequency.setValueAtTime(500, at)
  f.frequency.exponentialRampToValueAtTime(7000, at + dur)
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(0.09, at + dur - 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.1)
  src.connect(f).connect(g).connect(p.bus)
  src.start(at)
  src.stop(at + dur + 0.15)
}

function schedule(p: Playing, s: number, at: number) {
  const { song } = p
  const sixteenth = 60 / song.bpm / 4
  const i = s % 16
  const b = Math.floor(s / 16)
  const { sec, chord, n, last } = barAt(song, b)
  const row = (key: Row) => {
    const v = sec[key] ?? song[key]
    return v === undefined ? '' : typeof v === 'string' ? v : v[n % v.length]
  }
  const t = at + (i % 2 ? (song.swing ?? 0) * sixteenth : 0)
  const filling = last && !!sec.fill
  if (i === 0) {
    if (filling)
      p.fill = typeof sec.fill === 'string' ? FILLS[sec.fill] : RANDOM_FILLS[Math.floor(Math.random() * RANDOM_FILLS.length)]
    if (b > 0) {
      const before = barAt(song, b - 1)
      if (before.last && before.sec.fill) hiss(p, 'highpass', 5000, t, 1.4, 0.14)
    }
    if (last && sec.riser) riser(p, t, sixteenth * 16)
  }

  // drums; a fill takes over the second half of the bar and gets louder as it goes
  if (filling) {
    const vel = i < 8 ? 1 : 0.6 + (0.4 * (i - 8)) / 7
    drum(p, 'kick', p.fill.kick.charAt(i), t, 1)
    drum(p, 'snare', p.fill.snare.charAt(i), t, vel)
    drum(p, 'tom', p.fill.tom.charAt(i), t, vel)
    if (i < 8) drum(p, 'hat', row('hat').charAt(i), t, 1)
  } else {
    drum(p, 'kick', row('kick').charAt(i), t, 1)
    drum(p, 'snare', row('snare').charAt(i), t, 1)
    drum(p, 'hat', row('hat').charAt(i), t, 1)
    drum(p, 'tom', row('tom').charAt(i), t, 1)
  }

  const [root, quality] = chord
  const notes = SHAPES[quality].map((x) => root + x)
  // the bass stays between E1 and D#2 whatever the chord, so it is low but still heard on small speakers
  const bassRoot = 28 + ((((root - 28) % 12) + 12) % 12)
  const bass = row('bass')
  const bt = digit(bass.charAt(i))
  if (!isNaN(bt)) {
    const len = held(bass, i)
    const triad = SHAPES[quality].slice(0, 3).map((x) => bassRoot + x)
    voice(p, {
      wave: 'sawtooth',
      freq: midi(chordTone(triad, bt)),
      at: t,
      dur: sixteenth * (len > 1 ? len * 0.9 : 1.8),
      gain: 0.22,
      cutoff: 600,
    })
  }

  const pad = sec.pad ?? song.pad
  if (pad && i === 0) {
    const hold = pad === 'hold'
    notes.forEach((note, k) =>
      voice(p, {
        wave: song.padWave ?? 'sawtooth',
        freq: midi(note),
        at: t,
        dur: sixteenth * 16,
        gain: ((hold ? 0.03 : 0.045) * 3) / notes.length,
        cutoff: hold ? 1100 : 1400,
        attack: 0.6,
        release: hold ? 0.9 : undefined,
        detune: (k - 1) * 4,
      }),
    )
  }

  const arp = row('arp')
  const ad = digit(arp.charAt(i))
  if (!isNaN(ad)) {
    const len = held(arp, i)
    voice(p, {
      wave: sec.arpWave ?? song.arpWave ?? 'triangle',
      freq: midi(chordTone(notes, ad) + 12),
      at: t,
      dur: sixteenth * (len > 1 ? len : 1.6),
      gain: 0.07,
      cutoff: 3000,
      echo: true,
    })
  }

  const lead = row('lead')
  const deg = digit(lead.charAt(i))
  if (!isNaN(deg)) {
    const len = held(lead, i)
    const scale = SCALES[song.scale]
    const note = song.key + scale[deg % 7] + 12 * Math.floor(deg / 7)
    const wave = sec.leadWave ?? song.leadWave ?? 'square'
    // soft waves get a little more level so the tune is heard as well as a square one
    const gain = wave === 'triangle' || wave === 'sine' ? 0.058 : 0.045
    if (len > 1)
      voice(p, {
        wave,
        freq: midi(note),
        at: t,
        dur: sixteenth * len * 0.92,
        gain,
        cutoff: 2200,
        release: 0.12,
        echo: true,
        vibrato: len >= 4,
      })
    else voice(p, { wave, freq: midi(note), at: t, dur: sixteenth * 1.5, gain, cutoff: 2200, echo: true })
  }
}

function speaking() {
  return typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking
}

function tick() {
  const p = playing
  if (!p) return
  const a = audio()
  const now = a.currentTime
  // music level: off when muted, quieter while someone is talking
  const { muted, music } = useGame.getState()
  const level = muted || !music ? 0 : (speaking() ? 0.12 : 0.32) * (p.song.gain ?? 1)
  if (level !== p.level) {
    p.bus.gain.setTargetAtTime(level, now, 0.3)
    p.level = level
    p.quietSince = now
  }
  // while the music is off (and has faded out) the clock runs on but no notes are made
  const silent = level === 0 && now - p.quietSince > 2
  const sixteenth = 60 / p.song.bpm / 4
  while (p.nextTime < now + LOOKAHEAD) {
    // a step the page was too busy to schedule in time is skipped, not played late in a burst
    if (!silent && p.nextTime > now - 0.03) schedule(p, p.step, Math.max(p.nextTime, now))
    p.nextTime += sixteenth
    p.step++
  }
}

/** Switches the background track (null stops the music). */
export function playMusic(track: Track | null) {
  if (track === current) return
  current = track
  clearInterval(timer)
  if (playing) retire(playing)
  playing = null
  if (!track) return
  let id: SongId
  if (track === 'battle') {
    const options = BATTLE.filter((s) => s !== lastBattle)
    id = lastBattle = options[Math.floor(Math.random() * options.length)]
  } else id = track
  playing = start(SONGS[id])
  timer = window.setInterval(tick, TICK_MS)
  tick()
}
