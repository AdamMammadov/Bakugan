# regrow_tail.py in.glb out.glb '<json>': grows a tail the generator broke off, by bending a copy of a good
# tail (with its spikes and tip) along a new path, and drops the broken pieces.
# The good tail: the largest connected piece of the triangles inside `tail` (a box cut through its root, at
# the box's front face, z max). Its centre line is found by graph distance from that root; each vertex is kept
# in a frame carried along the line, then put in the same frame along the new line, through the `path`
# points (a smooth curve, from inside the body out to the tip). `trim` (0..1) skips that much of the good
# tail's root, so the copy is the thinner rest. Pieces lying wholly inside `remove` are dropped.
# Alpha Hydranoid: {"tail":[[0.1,-0.26,-0.46],[0.36,0.37,-0.12]],"remove":[[0.17,-0.31,-0.39],[0.32,-0.11,0.0]],
#   "trim":0.08,"path":[[0.1,-0.19,-0.07],[0.2,-0.2,-0.2],[0.32,-0.2,-0.33],[0.42,-0.23,-0.44],[0.47,-0.29,-0.39],[0.45,-0.32,-0.29]]}
import sys, json
import numpy as np, trimesh
from scipy.interpolate import splprep, splev
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra, connected_components
from scipy.spatial import cKDTree
src, dst, cfg = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
s = trimesh.load(src, force='mesh', process=False)
V = np.asarray(s.vertices, float); F = np.asarray(s.faces); UV = np.asarray(s.visual.uv, float)
w = s.copy(); w.merge_vertices(merge_tex=True, merge_norm=True)  # welded across UV seams, same face order
WF = np.asarray(w.faces); WV = np.asarray(w.vertices, float)
C = V[F].mean(1)
inbox = lambda P, b: np.all((P >= np.array(b[0])) & (P <= np.array(b[1])), axis=-1)

def pieces(faces):
    """Connected pieces (welded) among the given faces, largest first."""
    idx = {f: i for i, f in enumerate(faces)}
    adj = w.face_adjacency
    keep = np.array([a in idx and b in idx for a, b in adj], bool)
    e = adj[keep]
    n = len(faces)
    g = coo_matrix((np.ones(len(e)), ([idx[a] for a in e[:, 0]], [idx[b] for b in e[:, 1]])), shape=(n, n))
    k, lab = connected_components(g, directed=False)
    out = [np.asarray(faces)[lab == i] for i in range(k)]
    return sorted(out, key=len, reverse=True)

# drop the broken pieces
drop = np.zeros(len(F), bool)
near = np.where(inbox(C, cfg['remove']))[0]
allp = pieces(list(range(len(F))))
inside = inbox(C, cfg['remove'])
for p in allp:
    if inside[p].all(): drop[p] = True
print('dropped faces', int(drop.sum()))

# the good tail and its centre line
tail = pieces(list(np.where(inbox(C, cfg['tail']))[0]))[0]
tv = np.unique(WF[tail])
E = np.unique(np.sort(np.concatenate([WF[tail][:, [0, 1]], WF[tail][:, [1, 2]], WF[tail][:, [2, 0]]]), 1), axis=0)
L = np.linalg.norm(WV[E[:, 0]] - WV[E[:, 1]], axis=1)
n = len(WV)
G = coo_matrix((np.r_[L, L], (np.r_[E[:, 0], E[:, 1]], np.r_[E[:, 1], E[:, 0]])), shape=(n, n)).tocsr()
zr = cfg['tail'][1][2]
root = tv[WV[tv, 2] > zr - 0.015]
d = dijkstra(G, indices=root, min_only=True)[tv]
nb = 30
edges = np.linspace(0, d.max(), nb + 1)
mid = np.array([np.median(WV[tv][(d >= edges[k]) & (d <= edges[k + 1])], 0) for k in range(nb)])
mid = np.array([mid[max(0, k - 2):k + 3].mean(0) for k in range(nb)])  # smooth the zigzag


def curve(P, m=400):
    tck, _ = splprep(P.T, s=0, k=min(3, len(P) - 1))
    Q = np.array(splev(np.linspace(0, 1, m * 4), tck)).T
    a = np.r_[0, np.cumsum(np.linalg.norm(np.diff(Q, axis=0), axis=1))]
    t = np.linspace(0, a[-1], m)
    Q = np.array([np.interp(t, a, Q[:, k]) for k in range(3)]).T
    return Q, t


def frames(Q):
    T = np.gradient(Q, axis=0); T /= np.linalg.norm(T, axis=1)[:, None]
    up = np.array([0, 1.0, 0])
    N = np.zeros_like(Q); N[0] = up - up @ T[0] * T[0]; N[0] /= np.linalg.norm(N[0])
    for i in range(1, len(Q)):  # parallel transport: no twist along the line
        v = N[i - 1] - N[i - 1] @ T[i] * T[i]
        N[i] = v / np.linalg.norm(v)
    return T, N, np.cross(T, N)


Q0, s0 = curve(mid)
T0, N0, B0 = frames(Q0)
P = V[np.unique(F[tail])]
vid = np.unique(F[tail])
j = cKDTree(Q0).query(P)[1]
dv = P - Q0[j]
loc = np.stack([(dv * N0[j]).sum(1), (dv * B0[j]).sum(1), (dv * T0[j]).sum(1)], 1)
Q1, s1 = curve(np.array(cfg['path'], float))
T1, N1, B1 = frames(Q1)
cut = cfg.get('trim', 0) * s0[-1]
snew = (s0[j] - cut) / (s0[-1] - cut) * s1[-1]  # the trimmed root runs on into the body, past the path's start
k = np.clip(np.searchsorted(s1, snew), 0, len(s1) - 1)
base = Q1[k] + np.minimum(snew - s1[k], 0)[:, None] * T1[k]
newP = base + loc[:, :1] * N1[k] + loc[:, 1:2] * B1[k] + loc[:, 2:] * T1[k]
print('tail faces', len(tail), 'length', round(s0[-1], 3), '->', round(s1[-1], 3))

remap = np.full(len(V), -1); remap[vid] = len(V) + np.arange(len(vid))
V2 = np.r_[V, newP]; UV2 = np.r_[UV, UV[vid]]
F2 = np.r_[F[~drop], remap[F[tail]]]
out = trimesh.Trimesh(V2, F2, process=False, visual=trimesh.visual.TextureVisuals(uv=UV2, material=s.visual.material))
out.remove_unreferenced_vertices()
out.export(dst)
