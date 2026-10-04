/** Showroom profiles of the series' main characters (keyed like CHARACTERS in profile/avatar). */
export interface CharacterInfo {
  role: string
  story: string
  strengths: string[]
  weaknesses: string[]
  style: string
}

export const CHARACTER_INFO: Record<string, CharacterInfo> = {
  dan: {
    role: 'Leader of the Battle Brawlers',
    story:
      'A hot-headed boy who started the Battle Brawlers with his friends after Bakugan cards rained from the sky. His partner Drago chose him, and together they set out to protect Vestroia — and Earth — from the forces of Naga.',
    strengths: ['Never gives up, even in a losing brawl', 'Bold, all-out power plays with Pyrus cards', 'Inspires the whole team'],
    weaknesses: ['Rushes in without a plan', 'Impatient and easy to provoke', 'Weak at long-term strategy'],
    style: 'Aggressive: power-ups and big finishing attacks.',
  },
  runo: {
    role: 'Haos brawler · the team’s fighter',
    story:
      'She helps run her parents’ restaurant and brawls with fierce determination. With Tigrerra she proves time and again that a Haos brawler can hit as hard as anyone.',
    strengths: ['Fierce and competitive', 'Strong boosts and protective abilities', 'Keeps the team honest'],
    weaknesses: ['Quick temper', 'Lets feelings cloud her judgement'],
    style: 'Balanced: protects Tigrerra, then strikes back hard.',
  },
  marucho: {
    role: 'The team’s strategist',
    story:
      'The youngest Battle Brawler and heir to a wealthy family. Marucho studies every brawl like a puzzle and backs his friends with resources and analysis, while Preyas keeps him on his toes.',
    strengths: ['Brilliant tactician who reads opponents', 'Calm under pressure', 'Clever Aquos tricks'],
    weaknesses: ['Doubts himself', 'Struggles when a plan falls apart', 'Preyas can be unpredictable'],
    style: 'Tactical: weakens and outthinks the opponent.',
  },
  shun: {
    role: 'Former number-one ranked brawler',
    story:
      'Trained in ninja arts by his grandfather, Shun once topped the Bakugan rankings. He is quiet and prefers to brawl alone, but Skyress and his friends teach him the value of the team.',
    strengths: ['Lightning-fast reactions', 'Cool-headed and precise', 'Masters Ventus speed and evasion'],
    weaknesses: ['Lone wolf who keeps people at a distance', 'Too proud to ask for help'],
    style: 'Speed: strikes first and never stays in one place.',
  },
  julie: {
    role: 'Subterra brawler · the team’s cheerleader',
    story:
      'Upbeat and full of energy, Julie brawls with Gorem, the sturdiest Bakugan of the group. Her positivity lifts the team when things look darkest.',
    strengths: ['Unshakeable positivity', 'Gorem’s heavy defence and power', 'Never takes a defeat to heart'],
    weaknesses: ['Easily distracted', 'Can be overconfident'],
    style: 'Defensive: soaks up attacks, then crushes with raw power.',
  },
  alice: {
    role: 'Darkus brawler from Russia',
    story:
      'A gentle, clever girl who lives with her grandfather, a Bakugan researcher. She is caring and shy — and carries a secret tied to the Darkus attribute and the masked brawler Masquerade.',
    strengths: ['Kind and perceptive', 'Deep knowledge of Bakugan science', 'Calm, careful brawling'],
    weaknesses: ['Shy and reluctant to fight', 'Burdened by a hidden secret'],
    style: 'Careful: patient Darkus plays that turn the opponent’s power against them.',
  },
  masquerade: {
    role: 'The masked Darkus brawler',
    story:
      'A mysterious brawler in a mask who sends defeated Bakugan to the Doom Dimension. Masquerade brawls with Hydranoid and the dreaded Doom Card, and his true identity is the series’ great mystery.',
    strengths: ['Ruthless, flawless strategy', 'Devastating Darkus ability chains', 'Hydranoid’s raw power'],
    weaknesses: ['Arrogance', 'Underestimates the bond between brawler and Bakugan'],
    style: 'Relentless: drains the opponent and finishes with overwhelming force.',
  },
}
