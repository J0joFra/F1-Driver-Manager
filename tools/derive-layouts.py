"""
Misura la forma del giro dai tracciati veri.

    curl -sSo /tmp/circuits.json \
      https://raw.githubusercontent.com/bacinger/f1-circuits/master/f1-circuits.geojson
    python3 tools/derive-layouts.py

Perché due misure diverse invece di una. La geometria di partenza ha un punto
ogni ~36 metri: a quella densità una curva è approssimata da una corda, quindi
il raggio calcolato punto per punto **sottostima sempre** la curvatura. Preso
alla lettera, il conto diceva che a Marina Bay si va dritti per il 75% del
giro, il che è falso.

Due grandezze invece reggono al campionamento grossolano:

  1. `gradi/km`, la rotazione totale sulla lunghezza. Non dipende da quanto è
     fitto il campionamento e dice quanto è tortuoso un tracciato: Monza 171,
     Monaco 641. Da qui esce la frazione di rettilineo.

  2. La distribuzione dei raggi, che non dà i valori assoluti giusti ma dice
     **che tipo** di curve sono: Losail ha curvoni, l'Hungaroring tornanti.
     Da qui esce la ripartizione fra curve lente, medie e veloci, corretta
     dalla tortuosità perché dove si gira tanto le corde nascondono di più.

Dati: bacinger/f1-circuits, derivati da OpenStreetMap
(© i contributori OpenStreetMap, ODbL).
"""
import json, math
d = json.load(open('/tmp/circuits.json'))

def measure(coords):
    lat0 = sum(c[1] for c in coords) / len(coords)
    k = math.cos(math.radians(lat0))
    pts = [(c[0]*111320*k, c[1]*110540) for c in coords]
    if pts[0] == pts[-1]: pts = pts[:-1]
    n = len(pts)
    seg = [(math.atan2(pts[(i+1)%n][1]-pts[i][1], pts[(i+1)%n][0]-pts[i][0]),
            math.hypot(pts[(i+1)%n][0]-pts[i][0], pts[(i+1)%n][1]-pts[i][1])) for i in range(n)]
    length = sum(s[1] for s in seg)
    turn, tight = 0.0, 0.0
    b = {'fast':0.0,'medium':0.0,'slow':0.0,'straight':0.0}
    for i in range(n):
        dth = seg[(i+1)%n][0] - seg[i][0]
        while dth > math.pi: dth -= 2*math.pi
        while dth < -math.pi: dth += 2*math.pi
        deg = abs(math.degrees(dth)); turn += deg
        if deg >= 35: tight += deg
        span = (seg[i][1] + seg[(i+1)%n][1]) / 2
        r = float('inf') if abs(dth) < 1e-6 else span / abs(dth)
        key = 'straight' if r >= 420 else 'fast' if r >= 190 else 'medium' if r >= 85 else 'slow'
        b[key] += span
    tot = sum(b.values()) or 1
    return length/1000, turn/(length/1000), tight/max(1,turn), {k: v/tot for k,v in b.items()}

def layout(coords):
    km, tpk, tight, raw = measure(coords)
    # Quanto si va dritto: lo dice la densità di curva, che è la misura che
    # regge a un campionamento grossolano.
    straight = min(0.66, max(0.14, 0.66 * (175/tpk) ** 1.15))
    corners = 1 - straight
    # Che curve sono: lo dicono i raggi, corretti dalla tortuosità — dove si
    # gira tanto le curve sono strette, e la corda della polilinea lo nasconde.
    f = (175/tpk) ** 0.5
    wf = raw['fast'] * f
    wm = raw['medium']
    ws = raw['slow'] / f + tight * 0.45
    s = (wf + wm + ws) or 1
    return km, {
        'straight': round(straight, 3),
        'fast': round(corners * wf/s, 3),
        'medium': round(corners * wm/s, 3),
        'slow': round(corners * ws/s, 3),
    }

out = {}
for feat in d['features']:
    p = feat['properties']
    km, m = layout(feat['geometry']['coordinates'])
    tot = sum(m.values()); m['straight'] = round(m['straight'] + (1-tot), 3)
    out[p['id']] = {'name': p['Name'], 'km': round(km, 2), **m}
json.dump(out, open('/tmp/layouts.json','w'), indent=1)
for cid in ['it-1922','az-2016','be-1925','gb-1948','jp-1962','qa-2004','hu-1986','sg-2008','nl-1948','mc-1929']:
    m = out[cid]
    print(f"{m['name'][:30]:32} dritto {m['straight']:.2f} vel {m['fast']:.2f} med {m['medium']:.2f} len {m['slow']:.2f}")
