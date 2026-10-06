"""Builds src/data/roster.ts: the launch Bakugan beyond the original six (6 per attribute, plus a
few more added since: Preyas Diablo and Trox).

Facts (brawler, evolutions, story) come from the series as summarised on Wikipedia's
"List of Bakugan" and "List of Bakugan Battle Brawlers characters"; ability cards come from
the BakuProject card database (public/data/cards.json). Each Bakugan gets its own character
cards first, then normal ability cards of its attribute, up to CARDS cards.

Usage: python3 tools/data/roster.py
"""
import json
import re

CARDS = 7

# id, name, attribute, brawler, base G, [(evolution, series, G)], description
ROSTER = [
    # ---- Pyrus
    ('saurus', 'Saurus', 'pyrus', 'Dan Kuso', 320, [],
     'A horned, dinosaur-like warrior and one of the first Bakugan Dan ever brawled with. Saurus charges head-first and never backs down — a perfect match for a Pyrus brawler.'),
    ('falconeer', 'Falconeer', 'pyrus', 'Wild Bakugan', 340, [],
     'A falcon-headed humanoid said to resemble the Egyptian sun god Ra. Falconeer dives from the sky wrapped in flame.'),
    ('fourtress', 'Fourtress', 'pyrus', 'Chan Lee', 400, [],
     'Chan Lee\'s Guardian, an Asura-like warrior with three faces and four arms. Each face brings a different power — rage to attack, sadness to defend and joy to power up.'),
    ('helios', 'Helios', 'pyrus', 'Spectra Phantom', 470,
     [('Cyborg Helios', 'New Vestroia', 570), ('Helios MK2', 'New Vestroia', 650)],
     'Spectra\'s Guardian: a ruthless dragon covered in poison-tipped thorns that fires rapid cannonball blasts of fire. Rebuilt as a cyborg, he can repair himself in battle.'),
    ('robotallion', 'Robotallion', 'pyrus', 'Kenta', 330, [],
     'A humanoid robot Bakugan and the Guardian of the twin brawler Kenta. Sturdy and relentless, it grinds opponents down with heavy blows.'),
    ('scorpion', 'Scorpion', 'pyrus', 'Wild Bakugan', 320, [],
     'A burning scorpion Bakugan whose stinger tail strikes from unexpected angles.'),
    # ---- Aquos
    ('sirenoid', 'Sirenoid', 'aquos', 'Klaus von Hertzon', 380, [],
     'Klaus\'s Guardian, a mermaid-like Bakugan who lures opponents with the music of her harp. She is devoted to Klaus and lives in his office fish tank in ball form.'),
    ('elfin', 'Elfin', 'aquos', 'Marucho Marukura', 420, [('Minx Elfin', 'New Vestroia', 520)],
     'Marucho\'s cheerful Guardian in New Vestroia, a frog-like humanoid who shoots arrows from her fingers. Like Preyas she can change attribute in battle.'),
    ('elico', 'Elico', 'aquos', 'Mylene Farrow', 430, [('Blast Elico', 'New Vestroia', 530)],
     'Pure strength and brute force: six blade-armed tentacles, shoulder spikes and a golden diamond that fires a water blast. Elico can breathe under water and change attribute.'),
    ('preyas-diablo', 'Preyas Diablo', 'aquos', 'Marucho Marukura', 400, [('Preyas Angelo', 'Battle Brawlers', 500)],
     'One face of Marucho\'s Preyas II: the fiery, hot-headed Diablo, part Aquos and part Pyrus. Turned round it becomes Preyas Angelo, the calm, shining side that is part Aquos and part Haos.'),
    ('juggernoid', 'Juggernoid', 'aquos', 'Christopher', 340, [],
     'A turtle-like Bakugan whose shell shrugs off almost any attack. Christopher\'s steady Guardian.'),
    ('siege', 'Siege', 'aquos', 'Jenny', 350, [],
     'A knight-like Bakugan whose weapon changes with its attribute — as an Aquos Bakugan it wields a trident. Guardian of the idol brawler Jenny.'),
    ('tripod-epsilon', 'Tripod Epsilon', 'aquos', 'Marucho Marukura', 330, [],
     'A three-legged Trap Bakugan that Marucho deploys to support his Guardian, pinning opponents in place.'),
    # ---- Subterra
    ('cycloid', 'Cycloid', 'subterra', 'Billy Gilbert', 400, [],
     'A huge one-horned cyclops found in Bakugan Valley. Tough and eager to fight, his Left and Right Giganti smash the very Gate Card he stands on.'),
    ('wilda', 'Wilda', 'subterra', 'Mira Fermin', 450, [('Magma Wilda', 'New Vestroia', 550)],
     'Mira\'s Guardian, a massive creature of rock and hardened clay. Slow but nearly indestructible, he pounds the ground and finishes with a karate chop.'),
    ('premo-vulcan', 'Premo Vulcan', 'subterra', 'Gus Grav', 450, [('Rex Vulcan', 'New Vestroia', 560)],
     'Gus\'s towering Guardian, whose punches shatter steel armour — he can even fire his giant fists like cannonballs.'),
    ('baliton', 'Baliton', 'subterra', 'Mira Fermin', 340, [],
     'Mira\'s Trap Bakugan, a squat bruiser that guards her Guardian and slams anything that comes close.'),
    ('dynamo', 'Dynamo', 'subterra', 'Professor Clay', 340, [],
     'One of Professor Clay\'s Mechanical Bakugan, built for the Vexos — engines roar inside its armoured frame.'),
    ('hexados', 'Hexados', 'subterra', 'Gus Grav', 360, [],
     'Gus\'s Trap Bakugan, a fierce support fighter that strikes alongside Premo Vulcan.'),
    # ---- Ventus
    ('ingram', 'Ingram', 'ventus', 'Shun Kazami', 440, [('Master Ingram', 'New Vestroia', 550)],
     'Shun\'s Guardian in New Vestroia: a six-winged bird warrior with a steel chest and razor claws who nosedives straight through opponents. As Master Ingram he fights like a ninja.'),
    ('harpus', 'Harpus', 'ventus', 'Komba O\'Charlie', 360, [],
     'Komba\'s Guardian, a sharp-tongued harpy who loves mocking other Bakugan. Her signature card is Feather Storm.'),
    ('altair', 'Altair', 'ventus', 'Lync Volan', 430, [],
     'The first Mechanical Bakugan made by Professor Clay. Its red lenses see in the dark, its turbine wings let it hover and its battle cry deafens opponents.'),
    ('ravenoid', 'Ravenoid', 'ventus', 'Nene', 330, [],
     'A raven-like humanoid Bakugan, the Guardian of the young brawler Nene.'),
    ('hylash', 'Hylash', 'ventus', 'Shun Kazami', 340, [],
     'Shun\'s Trap Bakugan, a swift partner that sets up openings for Ingram.'),
    ('trox', 'Trox', 'ventus', 'Wynton Styles', 400, [],
     'A tyrannosaurus-like Bakugan from the new generation of brawlers: unbelievably strong and fiercely loyal to Wynton Styles, who brawls with him as his main partner.'),
    ('monarus', 'Monarus', 'ventus', 'Wild Bakugan', 320, [],
     'A fairy-like Bakugan riding the wind on butterfly wings — small, quick and hard to pin down.'),
    # ---- Haos
    ('tentaclear', 'Tentaclear', 'haos', 'Julio Santana', 350, [],
     'Julio\'s Guardian, a floating eye with tentacles. It cannot speak, but its gaze fires blinding beams of light.'),
    ('nemus', 'Nemus', 'haos', 'Baron Leltoy', 440, [('Saint Nemus', 'New Vestroia', 540)],
     'Baron\'s Guardian, built like an Egyptian king with blade-like wings. Its wrist guards deflect fire and its cane shoots a beam of light.'),
    ('brontes', 'Brontes', 'haos', 'Volt Luster', 420, [('Alto Brontes', 'New Vestroia', 530)],
     'A strange puppet-like giant that flies on the propeller atop its head and wraps opponents in its long arms. It can also use Darkus abilities.'),
    ('laserman', 'Laserman', 'haos', 'Masquerade', 400, [],
     'One of Masquerade\'s favourite Bakugan: a giant with three laser cannons on its shoulders that extinguish fire, freeze water and blow rock apart.'),
    ('piercian', 'Piercian', 'haos', 'Baron Leltoy', 350, [],
     'Baron\'s Trap Bakugan, a piercing lancer of light that backs up Nemus.'),
    ('wired', 'Wired', 'haos', 'Professor Clay', 330, [],
     'A Mechanical Bakugan created by Professor Clay for the Vexos, crackling with electric light.'),
    # ---- Darkus
    ('reaper', 'Reaper', 'darkus', 'Masquerade', 410, [],
     'A Bakugan resembling the Grim Reaper, born in the Darkus world of Vestroia and Masquerade\'s first Guardian.'),
    ('percival', 'Percival', 'darkus', 'Ace Grit', 460,
     [('Knight Percival', 'New Vestroia', 560), ('Midnight Percival', 'New Vestroia', 600)],
     'Ace\'s Guardian: an armoured monster that turns invisible under its cape, fires plasma from three mouths and whips up a black tornado. Together they fight to free enslaved Bakugan.'),
    ('hades', 'Hades', 'darkus', 'Shadow Prove', 470, [],
     'Shadow\'s Mechanical Bakugan, modelled on Alpha Hydranoid: three fire-breathing heads, six wings and three spiked tails. It must recharge after its strongest attacks.'),
    ('fear-ripper', 'Fear Ripper', 'darkus', 'Shuji', 340, [],
     'A humanoid Bakugan with huge extending claws, Guardian of the brawler Shuji.'),
    ('leonidas', 'Leonidas', 'darkus', 'Leo (video game)', 480, [('Omega Leonidas', 'Video game', 580)],
     'A one-of-a-kind dragon born in the Doom Dimension, the hero of the first Bakugan video game. He can take any attribute and evolves into Omega Leonidas to stop Vladitor.'),
    ('vladitor', 'Vladitor', 'darkus', 'Video game villain', 490, [('Battle Ax Vladitor', 'Video game', 600)],
     'The final foe of the first Bakugan video game, a towering Darkus warlord. As Battle Ax Vladitor his power is immense.'),
]

# brawlers who appear from New Vestroia (season 2) on
NEW_VESTROIA = {'Spectra Phantom', 'Mylene Farrow', 'Gus Grav', 'Mira Fermin', 'Ace Grit', 'Baron Leltoy', 'Shadow Prove',
                'Volt Luster', 'Lync Volan', 'Professor Clay'}

# Bakugan from a later series than the brawler sets above show
SERIES = {'trox': 'Battle Planet'}
# added after launch: they take their filler cards from their own slots, so adding them does not
# reshuffle the cards of the Bakugan already in players' collections
ADDED = ['preyas-diablo', 'trox']
# a Bakugan that shares a few character cards with another one (Diablo is a side of Preyas II)
CARD_ALIASES = {'preyas-diablo': ('Preyas', 2)}

ELEMENT_EFFECT = {'pyrus': 'fireball', 'aquos': 'waterJet', 'subterra': 'quake', 'ventus': 'tornado', 'haos': 'lightBeam', 'darkus': 'shadowOrb'}


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def ability(card, element):
    """Battle effect guessed from the card text (same rules as the admin panel)."""
    t = card['text']
    num = lambda pat: int((re.search(pat, t, re.I) or [None, 0])[1] or 0)
    kind, amount = 'attack', 100
    if re.search(r'transfer', t, re.I) and num(r'(\d+)\s*G'):
        kind, amount = 'drain', num(r'(\d+)\s*G')
    elif re.search(r'opponent.*loses?\s*-?(\d+)', t, re.I):
        kind, amount = 'weaken', num(r'loses?\s*-?(\d+)')
    elif re.search(r'gains?\s*\+?(\d+)', t, re.I):
        kind, amount = 'boost', num(r'gains?\s*\+?(\d+)')
    elif re.search(r'negat|nullif|cancel|block', t, re.I):
        kind, amount = 'shield', 0
    # keep single cards within the game's balance (a few real cards are worth +400 G)
    amount = min(amount, {'boost': 250, 'weaken': 200, 'drain': 200}.get(kind, amount))
    effect = 'aura' if kind == 'boost' else 'shieldDome' if kind == 'shield' else ELEMENT_EFFECT[element]
    out = {'id': slug(card['name']), 'name': card['name'], 'type': kind, 'amount': amount, 'effect': effect,
           'description': t.replace('\n', ' ')}
    if kind == 'attack':
        out['estimated'] = True
    return out


def main():
    cards = json.load(open('public/data/cards.json'))
    attr_cards = {}
    for c in cards:
        if c['type'] == 'ability' and len(c['attributes']) == 1:
            attr_cards.setdefault(c['attributes'][0], []).append(c)
    gates = {re.sub(r'^(Pyrus|Aquos|Subterra|Ventus|Haos|Darkus)\s+', '', c['name']) for c in cards if c['type'] == 'character-gate'}

    out = []
    launch = [r for r in ROSTER if r[0] not in ADDED]
    for bid, name, element, brawler, g, evos, desc in ROSTER:
        i = launch.index(next(r for r in launch if r[0] == bid)) if bid not in ADDED else len(launch) + ADDED.index(bid)
        alias, alias_max = CARD_ALIASES.get(bid, (None, 5))
        bases = {name, name.replace('Fourtress', 'Fortress')} | ({alias} if alias else set())
        own = [c for c in cards if c['type'] == 'character' and c['user']
               and re.sub(r'^(Pyrus|Aquos|Subterra|Ventus|Haos|Darkus)\s+', '', c['user']) in bases]
        # this attribute's variant first, then the generic cards of the Bakugan
        own.sort(key=lambda c: (0 if c['user'].lower().startswith(element) else 1 if c['user'] in bases else 2, c['name']))
        own = [c for c in own if not re.match(r'^(Pyrus|Aquos|Subterra|Ventus|Haos|Darkus)\s', c['user']) or c['user'].lower().startswith(element)]
        picked, seen = [], set()
        for c in own:
            if c['name'] not in seen and len(picked) < alias_max:
                picked.append(c)
                seen.add(c['name'])
        pool = attr_cards[element]
        k = i * 3  # rotate so Bakugan of one attribute get different filler cards
        while len(picked) < CARDS:
            c = pool[k % len(pool)]
            k += 1
            if c['name'] not in seen:
                picked.append(c)
                seen.add(c['name'])
        series = SERIES.get(bid) or ('New Vestroia' if brawler in NEW_VESTROIA else 'Battle Brawlers')
        evolutions = [{'name': name, 'series': series, 'gPower': g}] + [{'name': n, 'series': s, 'gPower': p} for n, s, p in evos]
        out.append({
            'id': bid, 'name': name, 'element': element, 'brawler': brawler,
            'series': series,
            'baseG': g, 'brawlG': g + 100, 'description': desc,
            'abilities': [ability(c, element) for c in picked],
            'evolutions': evolutions,
            **({'characterGate': True} if name in gates or name.replace('Fourtress', 'Fortress') in gates else {}),
        })

    ts = ['import type { Bakugan } from \'./bakugan\'', '',
          '/**', ' * The launch roster beyond the original six: 6 more Bakugan per attribute, plus later additions.',
          ' * Generated by tools/data/roster.py — edit the script, not this file.', ' */',
          'export const ROSTER: Bakugan[] = ' + json.dumps(out, indent=2, ensure_ascii=False), '']
    open('src/data/roster.ts', 'w').write('\n'.join(ts))
    for b in out:
        print(f"{b['element']:9s} {b['name']:15s} {b['baseG']}G cards={len(b['abilities'])} evo={len(b['evolutions'])} gate={b.get('characterGate', False)} own={[a['name'] for a in b['abilities'][:2]]}")


main()
