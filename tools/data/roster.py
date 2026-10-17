"""Builds src/data/roster.ts: the launch Bakugan beyond the original six (6 per attribute, plus a
few more added since: Preyas Diablo and Trox).

Facts (brawler, evolutions, story) come from the series as summarised on Wikipedia's
"List of Bakugan" and "List of Bakugan Battle Brawlers characters". Each Bakugan's ability cards
are its own: first its character cards from the BakuProject card database (public/data/cards.json),
then the abilities it uses in the anime and the video games, base form first, then its evolutions
(tools/data/anime_abilities.json, from each Bakugan's page on the Bakugan Wiki,
https://bakugan.fandom.com). Only a Bakugan with too few of those gets normal ability cards of its
attribute, the ones the fewest other Bakugan have. The original six get theirs here too
(ORIGINAL_ABILITIES); their other facts are in src/data/bakugan.ts.

Usage: python3 tools/data/roster.py
"""
import json
import re
from collections import Counter
from difflib import SequenceMatcher

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
    ('rubanoid', 'Rubanoid', 'pyrus', 'Sid Arkale', 470, [],
     'Sid Arkale\'s Guardian, a dragon coated in rubies under crimson armour. It sends out waves of red energy and cuts with blades as hard as gemstone, and later fought for Ren Krawler and Linus Claude.'),
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
    ('hydorous', 'Hydorous', 'aquos', 'Shun Kazami', 400, [],
     'The prince of the seas: a fast, agile and ruthless lion-like Bakugan from the new generation, Shun Kazami\'s Guardian in Battle Planet. His all-out aggression is the opposite of Shun\'s calm, and the two complete each other.'),
    ('juggernoid', 'Juggernoid', 'aquos', 'Christopher', 340, [],
     'A turtle-like Bakugan whose shell shrugs off almost any attack. Christopher\'s steady Guardian.'),
    ('siege', 'Siege', 'aquos', 'Jenny', 350, [],
     'A knight-like Bakugan whose weapon changes with its attribute — as an Aquos Bakugan it wields a trident. Guardian of the idol brawler Jenny.'),
    # Robotallion as an Aquos Bakugan (the Xbox 360 game's Aquos colours), in Tripod Epsilon's place
    ('robotallion', 'Robotallion', 'aquos', 'Kenta', 330, [],
     'A humanoid robot Bakugan and the Guardian of the twin brawler Kenta. Sturdy and relentless, it grinds opponents down with heavy blows.'),
    # ---- Subterra
    ('manion', 'Manion', 'subterra', 'Klaus von Hertzon', 380, [],
     'A mysterious sphinx with a lion\'s body, huge wings and golden armour over its head, back and forearms. It soars on its great wingspan and strikes from above with four pairs of razor claws. Klaus kept a Subterra Manion in his collection.'),
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
    ('pegatrix', 'Pegatrix', 'haos', 'Lia Venegas', 400, [],
     'A winged unicorn-Pegasus from the new generation, Lia Venegas\'s partner in Battle Planet: strong-willed and powerful in battle, yet always finding the beauty in the world around her.'),
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
    ('howlkor', 'Howlkor', 'darkus', 'Lightning', 400, [],
     'A giant three-headed, Cerberus-like hound from the new generation and the Guardian of Lightning. Howlkor is so set on winning that he often scares his own brawler.'),
    ('vladitor', 'Vladitor', 'darkus', 'Video game villain', 490, [('Battle Ax Vladitor', 'Video game', 600)],
     'The final foe of the first Bakugan video game, a towering Darkus warlord. As Battle Ax Vladitor his power is immense.'),
    ('dharak', 'Dharak', 'darkus', 'Emperor Barodius', 800, [('Phantom Dharak', 'Gundalian Invaders', 2800)],
     'Emperor Barodius\'s Guardian and the Darkus pair of the Twelve Orders of Gundalia, from the same ancient lineage as Drago. He blasts dark energy from his mouth, and few Bakugan have ever stood against him.'),
]

# brawlers who appear from New Vestroia (season 2) on
NEW_VESTROIA = {'Spectra Phantom', 'Mylene Farrow', 'Gus Grav', 'Mira Fermin', 'Ace Grit', 'Baron Leltoy', 'Shadow Prove',
                'Volt Luster', 'Lync Volan', 'Professor Clay'}

# Bakugan from a later series than the brawler sets above show
SERIES = {'trox': 'Battle Planet', 'hydorous': 'Battle Planet', 'howlkor': 'Battle Planet', 'pegatrix': 'Battle Planet',
          'rubanoid': 'Gundalian Invaders', 'dharak': 'Gundalian Invaders'}
# added after launch: they pick their filler cards after everyone else, so adding one does not
# change the cards of the Bakugan already in players' collections
ADDED = ['preyas-diablo', 'trox', 'hydorous', 'howlkor', 'manion', 'pegatrix', 'rubanoid', 'dharak']
# the game owner's own Bakugan (src/season/release.ts OWNER_ONLY): its anime abilities (Bakugan Wiki), stronger
# than any other Bakugan's cards; the wiki gives no G values, so they are the owner's choice
OWNER_DECKS = {'dharak': [
    ('Darkness Glow', 'boost', 400, 'Dharak glows with Darkus power: adds 400 G to Dharak.'),
    ('Westwall Shield', 'shield', 0, 'The Darkness Wall: nullifies the opponent\'s next attack or ability.'),
    ('Thunder Probe', 'weaken', 300, 'Dark lightning pins the opponent down: subtracts 300 G from the opponent.'),
    ('Darkness Waver', 'attack', 300, 'A wave of dark energy blasted from Dharak\'s mouth.'),
    ('High Skewed Waver', 'drain', 300, 'Transfers 300 G from the opponent to Dharak.'),
    ('Evil Blast', 'attack', 400, 'The Evil Blow: Dharak\'s crushing blast of darkness.'),
    ('Exodus Waver', 'attack', 500, 'Dharak\'s strongest wave, which few Bakugan have ever withstood.'),
],
    # Phantom Dharak's own cards, after what each did in Gundalian Invaders (Final Strike to Destiny Revealed)
    'dharak~1': [
    ('Darkness Shaker', 'boost', 800, 'The power that defeated Coredem: adds 800 G to Phantom Dharak.'),
    ('Tempest Shield', 'shield', 0, 'The storm wall that stopped five Bakugan\'s attacks at once: blocks the opponent\'s next attack or ability.'),
    ('Exodus Shaker', 'weaken', 600, 'The blast that defeated Raptorix: subtracts 600 G from the opponent.'),
    ('Lavolta', 'drain', 600, 'Ra Bolt, which defeated Akwimos: transfers 600 G from the opponent to Phantom Dharak.'),
    ('Photon Gladiator', 'attack', 500, 'The strike that defeated every Castle Knight, and Hawktor.'),
    ('Thunder Gladiator', 'attack', 600, 'The strike that broke Neathia\'s Third Shield in one blow.'),
    ('Chaos Magnalia', 'finisher', 0, 'The blast that wiped out Dragonoid Colossus, Stoica\'s Lythirus and Gill\'s ship: defeats the opponent\'s Bakugan at once, whatever its G-Power, through any shield.'),
]}
# the original six (src/data/bakugan.ts) and how many cards each has
ORIGINAL = [('dragonoid', 'Dragonoid', 'pyrus', 8), ('preyas', 'Preyas', 'aquos', 7), ('gorem', 'Gorem', 'subterra', 7),
            ('skyress', 'Skyress', 'ventus', 7), ('tigrerra', 'Tigrerra', 'haos', 7), ('hydranoid', 'Hydranoid', 'darkus', 7)]
# a Bakugan that shares a few character cards with another one (Diablo is a side of Preyas II)
CARD_ALIASES = {'preyas-diablo': ('Preyas', 2)}

ELEMENT_EFFECT = {'pyrus': 'fireball', 'aquos': 'waterJet', 'subterra': 'quake', 'ventus': 'tornado', 'haos': 'lightBeam', 'darkus': 'shadowOrb'}
# a second look for some attributes' attacks, taken in turn
ELEMENT_EFFECT_2 = {'pyrus': 'flameWave', 'aquos': 'waterSphere'}
# the most one card may do, so no single card decides a battle
CAP = {'boost': 250, 'weaken': 200, 'drain': 200}
# G values in the anime run about twice the card game's
ANIME_G = 0.5
WIKI = json.load(open('tools/data/anime_abilities.json'))
# one card under two names (card database / wiki)
SAME_AS = {'Green Nobility - Soar Violent Winds': 'Green Nobility - Violent Wind'}


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def effect(kind, element, n):
    if kind == 'boost':
        return 'aura'
    if kind == 'shield':
        return 'shieldDome'
    return ELEMENT_EFFECT_2[element] if n % 2 and element in ELEMENT_EFFECT_2 else ELEMENT_EFFECT[element]


def anime_ability(a, who, element):
    """Battle effect of an anime or video game ability, from its wiki text."""
    t, name = a['text'], a['name']
    first = lambda: re.split(r'(?<=\.)\s', t)[0] if t else ''
    num = lambda pat: [int(x) for x in re.findall(pat, t, re.I)]
    add, sub, tr = num(r'(?:adds|gains) (\d+) ?G'), num(r'(?:subtracts|loses) (\d+) ?G'), num(r'transfers (\d+)')
    g = lambda n, kind: max(25, min(CAP[kind], round(n * ANIME_G / 25) * 25))
    if tr or (add and sub):
        kind = 'drain'
        amount = g(tr[0] if tr else (add[0] + sub[0]) / 2, kind)
        text = f'Transfers {amount} G from the opponent to {who}.'
    elif sub:
        kind, amount = 'weaken', g(sub[0], 'weaken')
        text = f'Subtracts {amount} G from the opponent.'
    elif add:
        kind, amount = 'boost', g(add[0], 'boost')
        text = f'Adds {amount} G to {who}.'
    elif re.search(r'power (level )?to 0|base (power )?level|base power', t, re.I):
        kind, amount = 'weaken', CAP['weaken']
        text = 'Brings the opponent\'s G-Power down: subtracts ' + str(amount) + ' G.'
    elif re.search(r'nullif|prevent|block|reflect|immune|shield|protect|cancel|negat|deflect|absorb|recover|stagger', t, re.I) or (
            not t and re.search(r'shield|barrier|guard|defen|armou?r|mist|haze|reflect|wall', name, re.I)):
        kind, amount = 'shield', 0
        text = first() or f'{who} raises a shield against the opponent\'s next move.'
    else:
        # no G value stated: what the move does, by its name and story (amount picked for balance)
        both = name + ' ' + t
        if re.search(r'mirage|mist\b|haze|petrif|stone|withstand|dodge|evade|invisib', both, re.I):
            kind, amount = 'shield', 0
        elif re.search(r'revitali|recover|restore|\bcharge|\bpower(s|ed)? up|\broar|howl|uproar|spirit|bigger', both, re.I):
            kind, amount = 'boost', 100
        elif re.search(r'draw|drain|absorb|siphon|copy|copies', both, re.I):
            kind, amount = 'drain', 100
        elif re.search(r'blind|bind|wrap|lasso|root|trap|freeze|stun|stops? time|gravity|move', both, re.I):
            kind, amount = 'weaken', 100
        else:
            kind = 'attack'
            amount = 150 if re.search(r'powerful|massive|devastating|explosive|brutal|barrage|volley|crash|burst', both, re.I) else 100
        text = first() or {
            'shield': f'{who} raises a shield against the opponent\'s next move.',
            'boost': f'{who} powers up: adds {amount} G.',
            'drain': f'Transfers {amount} G from the opponent to {who}.',
            'weaken': f'Holds the opponent down: subtracts {amount} G.',
            'attack': f'One of {who}\'s signature attacks.',
        }[kind]
        return {'id': slug(name), 'name': name, 'type': kind, 'amount': amount, 'effect': '', 'description': text, 'estimated': True}
    return {'id': slug(name), 'name': name, 'type': kind, 'amount': amount, 'effect': '', 'description': text}


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
    amount = min(amount, CAP.get(kind, amount))
    out = {'id': slug(card['name']), 'name': card['name'], 'type': kind, 'amount': amount, 'effect': '',
           'description': t.replace('\n', ' ')}
    if kind == 'attack':
        out['estimated'] = True
    return out


PREFIX = re.compile(r'^(Pyrus|Aquos|Subterra|Ventus|Haos|Darkus)\s+')


def own_cards(cards, bid, name, element):
    """The Bakugan's own character cards: this attribute's variant first, then its generic ones."""
    alias, alias_max = CARD_ALIASES.get(bid, (None, CARDS))
    bases = {name, name.replace('Fourtress', 'Fortress')} | ({alias} if alias else set())
    own = [c for c in cards if c['type'] == 'character' and c['user'] and PREFIX.sub('', c['user']) in bases]
    own.sort(key=lambda c: (0 if c['user'].lower().startswith(element) else 1 if c['user'] in bases else 2, c['name']))
    own = [c for c in own if not PREFIX.match(c['user']) or c['user'].lower().startswith(element)]
    return own[:alias_max]


def anime(bid, who, element):
    """The Bakugan's anime and video game abilities, base form first, then its evolutions."""
    out = []
    for key in [bid] + sorted(k for k in WIKI if k.startswith(bid + '~')):
        for a in WIKI.get(key, {}).get('abilities', []):
            out.append((anime_ability(a, who, element), a.get('standard', False)))
    return out


def key(name):
    """A card name to compare: lower case, letters only, without a bracketed second name."""
    return re.sub(r'[^a-z]', '', re.sub(r'\(.*?\)', '', name.lower()))


def same(a, b):
    """Two spellings of one card (Aqua / Aquos Javelin, Flare Binder / Blinder)."""
    a, b = SAME_AS.get(a, a), SAME_AS.get(b, b)
    if key(a) == key(b):
        return True
    return len(a.split()) == len(b.split()) and SequenceMatcher(None, key(a), key(b)).ratio() >= 0.85


def deck(cards, attr_cards, used, bid, name, element, count):
    """Picks the Bakugan's cards. `used` counts every card name already given to a Bakugan."""
    picked = []
    taken = lambda n: any(same(n, p['name']) for p in picked)

    def take(ab):
        if len(picked) < count and not taken(ab['name']):
            picked.append(ab)

    mine = anime(bid, name, element)
    for c in own_cards(cards, bid, name, element):
        ab = ability(c, element)
        # a card whose text states no G value: the anime's version of it says what it does
        told = next((a for a, _ in mine if same(a['name'], ab['name']) and not a.get('estimated')), None)
        take({**told, 'id': ab['id'], 'name': ab['name']} if ab.get('estimated') and told else ab)
    special = [ab for ab, standard in mine if not standard]
    # its own abilities, those no other Bakugan has first; a few attacks and shields among them at most,
    # so the deck keeps a mix of G effects
    limit = {'attack': 2, 'shield': 2}
    for rounds in range(2):
        for ab in sorted(special, key=lambda ab: used[key(ab['name'])] > 0):
            kinds = sum(1 for p in picked if p['type'] == ab['type'])
            if rounds or kinds < limit.get(ab['type'], count):
                take(ab)
    # then its attribute's standard abilities that it uses in the anime and the attribute's other cards,
    # those the fewest Bakugan have first
    pool = attr_cards[element]
    rest = [(used[key(ab['name'])], 0, i, ab) for i, (ab, standard) in enumerate(mine) if standard]
    rest += [(used[key(c['name'])], 1, i, ability(c, element)) for i, c in enumerate(pool)]
    for *_, ab in sorted(rest, key=lambda r: r[:3]):
        take(ab)
    for i, ab in enumerate(picked):
        ab['effect'] = effect(ab['type'], element, i)
        used[key(ab['name'])] += 1
    return picked


def main():
    cards = json.load(open('public/data/cards.json'))
    attr_cards = {}
    for c in cards:
        if c['type'] == 'ability' and len(c['attributes']) == 1:
            attr_cards.setdefault(c['attributes'][0], []).append(c)
    gates = {PREFIX.sub('', c['name']) for c in cards if c['type'] == 'character-gate'}

    # the original six first, then the launch roster, then the later additions in the order they came
    used = Counter()
    original = {bid: deck(cards, attr_cards, used, bid, name, element, n) for bid, name, element, n in ORIGINAL}
    order = [r for r in ROSTER if r[0] not in ADDED] + sorted((r for r in ROSTER if r[0] in ADDED), key=lambda r: ADDED.index(r[0]))
    decks = {r[0]: deck(cards, attr_cards, used, r[0], r[1], r[2], CARDS) for r in order if r[0] not in OWNER_DECKS}
    owner_card = lambda i, n, k, a, d: {'id': slug(n), 'name': n, 'type': k, 'amount': a, 'effect': effect(k, 'darkus', i),
                                        'description': d, 'estimated': True}
    for bid, owner in OWNER_DECKS.items():
        if '~' not in bid:
            decks[bid] = [owner_card(i, *c) for i, c in enumerate(owner)]

    out = []
    for bid, name, element, brawler, g, evos, desc in ROSTER:
        series = SERIES.get(bid) or ('New Vestroia' if brawler in NEW_VESTROIA else 'Battle Brawlers')
        evolutions = [{'name': name, 'series': series, 'gPower': g}] + [{'name': n, 'series': s, 'gPower': p} for n, s, p in evos]
        # an evolution with cards of its own (OWNER_DECKS '<id>~<form>')
        for form, evo in enumerate(evolutions):
            if f'{bid}~{form}' in OWNER_DECKS:
                evo['abilities'] = [owner_card(i, *c) for i, c in enumerate(OWNER_DECKS[f'{bid}~{form}'])]
        out.append({
            'id': bid, 'name': name, 'element': element, 'brawler': brawler,
            'series': series,
            'baseG': g, 'brawlG': g + 100, 'description': desc,
            'abilities': decks[bid],
            'evolutions': evolutions,
            **({'characterGate': True} if name in gates or name.replace('Fourtress', 'Fortress') in gates else {}),
        })

    ts = ['import type { Ability, Bakugan } from \'./bakugan\'', '',
          '/**', ' * The launch roster beyond the original six: 6 more Bakugan per attribute, plus later additions.',
          ' * Generated by tools/data/roster.py — edit the script, not this file.', ' */',
          'export const ROSTER: Bakugan[] = ' + json.dumps(out, indent=2, ensure_ascii=False), '',
          '/** The original six Bakugan\'s ability cards (their other facts are in bakugan.ts). */',
          'export const ORIGINAL_ABILITIES: Record<string, Ability[]> = ' + json.dumps(original, indent=2, ensure_ascii=False), '']
    open('src/data/roster.ts', 'w').write('\n'.join(ts))
    shared = sorted(((n, k) for n, k in used.items() if k > 1), key=lambda x: -x[1])
    print(f'{len(used)} different cards, {len(shared)} on more than one Bakugan:', shared)
    for bid, ab in list(original.items()) + list(decks.items()):
        print(f"{bid:14s}", ', '.join(f"{a['name']} ({a['type']} {a['amount']})" for a in ab))


main()
