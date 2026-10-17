# drop_loose.py in.glb out.glb gap [max_faces]: drops the loose pieces a generator left floating: connected
# pieces (joined across UV seams) more than `gap` (model units) from the biggest piece, up to max_faces each.
import sys
import numpy as np, trimesh
from scipy.spatial import cKDTree
s = trimesh.load(sys.argv[1], force='mesh', process=False)
gap = float(sys.argv[3]); most = int(sys.argv[4]) if len(sys.argv) > 4 else 2000
w = s.copy(); w.merge_vertices(merge_tex=True, merge_norm=True)
cc = sorted(trimesh.graph.connected_components(w.face_adjacency, nodes=np.arange(len(w.faces)), min_len=1), key=len, reverse=True)
main = cKDTree(w.vertices[np.unique(w.faces[cc[0]])])
keep = np.ones(len(s.faces), bool)
for c in cc[1:]:
    if len(c) <= most and main.query(w.vertices[np.unique(w.faces[c])])[0].min() > gap:
        keep[c] = False
print('dropped', int((~keep).sum()), 'faces in', sum(1 for c in cc[1:] if not keep[c[0]]), 'pieces')
out = s.submesh([np.where(keep)[0]], append=True)
out.visual = trimesh.visual.TextureVisuals(uv=out.visual.uv, material=s.visual.material)
out.export(sys.argv[2])
