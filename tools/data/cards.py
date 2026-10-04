"""Builds public/data/cards.json from the BakuProject card database.

Usage: python3 tools/data/cards.py [path-to-cards.json]
Without a path the database is downloaded from https://bakuproject.info/json/cards.json
"""
import json
import re
import sys
import urllib.request

SOURCE = 'https://bakuproject.info/json/cards.json?=v5'
TYPES = {'sac': 'character', 'nac': 'ability', 'agc': 'attribute-gate', 'chgc': 'character-gate', 'cogc': 'command-gate'}


def load():
    if len(sys.argv) > 1:
        return json.load(open(sys.argv[1]))
    with urllib.request.urlopen(SOURCE) as r:
        return json.load(r)


def walk(node, pending=False):
    if isinstance(node, dict):
        if 'name' in node and 'type' in node:
            yield node, pending
            return
        for key, value in node.items():
            yield from walk(value, pending or key == 'pending')
    elif isinstance(node, list):
        for value in node:
            yield from walk(value, pending)


def slug(text):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


def main():
    data = load()
    cards, seen = [], set()
    for raw, pending in walk(data):
        desc = raw['description']
        if 'english' in desc:
            text = desc['english'].strip()
        else:
            # cards with one effect per attribute: an intro text plus "[Attribute] effect" lines
            parts = [desc['text']['english'].strip()] if 'text' in desc else []
            parts += [v['english'].strip() for k, v in desc.items() if k != 'text']
            text = '\n'.join(parts)
        # ability cards start with "[Bakugan]" or "[Attribute]" naming who can use them
        user = None
        m = re.match(r'^\[([^\]]+)\]\s*\n?', text)
        if m:
            user = m.group(1).strip()
            text = text[m.end():].strip()
        attribute = raw.get('attribute')
        attributes = [a.strip() for a in attribute] if isinstance(attribute, list) else [attribute] if attribute else []
        base = f"{raw['type']}-{slug(raw['name']['english'])}"
        cid, n = base, 2
        while cid in seen:
            cid, n = f'{base}-{n}', n + 1
        seen.add(cid)
        cards.append({
            'id': cid,
            'name': raw['name']['english'],
            'type': TYPES[raw['type']],
            'attributes': attributes,
            'user': user,
            'text': text,
            'hsp': raw['hsp'],
            'limit': raw['limit'],
            'catalogue': raw['catalogue'],
            **({'pending': True} if pending else {}),
        })
    cards.sort(key=lambda c: (c['type'], c['name']))
    json.dump(cards, open('public/data/cards.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    print(len(cards), 'cards written')


main()
