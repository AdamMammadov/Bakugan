# glbtex.py get in.glb out_dir            -> writes each image as out_dir/img<i>.<ext>
# glbtex.py put in.glb out.glb i=file ... -> replaces image i with file (PNG/JPEG/WebP by extension)
import sys, json, struct, os
def read(p):
    data = open(p, 'rb').read()
    jl = struct.unpack_from('<I', data, 12)[0]
    g = json.loads(data[20:20 + jl])
    bl = struct.unpack_from('<I', data, 20 + jl)[0]
    b = data[28 + jl:28 + jl + bl]
    views = [bytes(b[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]) for v in g['bufferViews']]
    return g, views
def write(p, g, views):
    blob = b''
    for v, b in zip(g['bufferViews'], views):
        blob += b'\0' * (-len(blob) % 4)
        v['byteOffset'] = len(blob); v['byteLength'] = len(b); blob += b
    blob += b'\0' * (-len(blob) % 4)
    g['buffers'][0]['byteLength'] = len(blob)
    js = json.dumps(g, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4)
    open(p, 'wb').write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(blob)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(blob), 0x004E4942) + blob)
cmd = sys.argv[1]
g, views = read(sys.argv[2])
ext = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp'}
mime = {v: k for k, v in ext.items()}
if cmd == 'get':
    os.makedirs(sys.argv[3], exist_ok=True)
    for i, img in enumerate(g.get('images', [])):
        f = f"{sys.argv[3]}/img{i}.{ext[img['mimeType']]}"
        open(f, 'wb').write(views[img['bufferView']]); print(f)
    print(json.dumps(g.get('materials')), json.dumps(g.get('textures')))
else:
    for arg in sys.argv[4:]:
        i, f = arg.split('=', 1); i = int(i)
        img = g['images'][i]
        views[img['bufferView']] = open(f, 'rb').read()
        img['mimeType'] = mime[f.rsplit('.', 1)[1].replace('jpeg', 'jpg')]
    if not any(i['mimeType'] == 'image/webp' for i in g['images']):
        for k in ('extensionsUsed', 'extensionsRequired'):
            if k in g:
                g[k] = [e for e in g[k] if e != 'EXT_texture_webp']
                if not g[k]: del g[k]
        for t in g.get('textures', []):
            ex = t.get('extensions', {}).pop('EXT_texture_webp', None)
            if ex is not None: t['source'] = ex['source']
            if 'extensions' in t and not t['extensions']: del t['extensions']
    write(sys.argv[3], g, views)
    print('wrote', sys.argv[3], os.path.getsize(sys.argv[3]))
