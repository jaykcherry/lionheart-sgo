#!/usr/bin/env python3
"""Merge street-level geocodes into data/school-geo-2026-27.json (id -> {lat, lon, src}).

Inputs (row index = position in data/tn-private-schools-2026-27.psv, 0-based):
  data/geocode/census.json  [[row, "E"|"N", lon, lat], ...]  US Census batch geocoder, street address + ZIP
                            ("E" exact, "N" interpolated along the street)
  data/geocode/osm.json     {row: [lat, lon, type, category]}  OpenStreetMap Nominatim search by
                            "<school name>, <city>, Tennessee" (hits only)
  data/geocode/osm-address.json  same shape: Nominatim street-address search for rows Census missed,
                            keeping only house/building-level hits

Rule: trust an OSM hit only when it is a school-like feature near the Census point (it marks the campus,
not a street-range estimate); otherwise use Census; with no Census match, use OSM if it lands near the
ZIP centroid; else leave the school out so the build falls back to the ZIP centroid.

Then run scripts/build-schools.py.
"""
import json, math, re
import zipcodes

import csv
rows = list(csv.DictReader(open('data/tn-private-schools-2026-27.psv'), delimiter='|'))
census = {r[0]: (r[3], r[2], r[1]) for r in json.load(open('data/geocode/census.json'))}
osm = {int(k): v for k, v in json.load(open('data/geocode/osm.json')).items()}
osm_addr = {int(k): v for k, v in json.load(open('data/geocode/osm-address.json')).items()}
SCHOOLISH = {'school', 'college', 'kindergarten', 'university', 'childcare', 'place_of_worship', 'building', 'yes', 'church'}

def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))

# Same id rule as build-schools.py.
DEMO = {}
try:
    src = open('scripts/build-schools.py').read()
    m = re.search(r'DEMO = (\{.*?\})', src, re.S)
    if m: DEMO = eval(m.group(1))
except Exception: pass

out, seen, stats = {}, {}, {'osm': 0, 'census': 0, 'zip': 0}
for i, r in enumerate(rows):
    sid = DEMO.get(r['name']) or re.sub(r'[^a-z0-9]+', '-', r['name'].lower()).strip('-')[:40]
    if sid in seen: seen[sid] += 1; sid = f'{sid}-{seen[sid]}'
    else: seen[sid] = 1
    z = zipcodes.matching(r['zip'])[0]; zc = (float(z['lat']), float(z['long']))
    c, o = census.get(i), osm.get(i)
    pick = None
    if o and (o[2] in SCHOOLISH or o[3] in ('amenity', 'building')):
        op = (o[0], o[1])
        if c and km(op, c[:2]) <= (1.5 if c[2] == 'E' else 3.0): pick = (op, 'osm')
        elif not c and km(op, zc) <= 25: pick = (op, 'osm')
    if not pick and c: pick = (c[:2], 'census')
    if not pick and i in osm_addr and km(osm_addr[i][:2], zc) <= 25: pick = (tuple(osm_addr[i][:2]), 'osm')
    if pick:
        out[sid] = {'lat': round(pick[0][0], 5), 'lon': round(pick[0][1], 5), 'src': pick[1]}
        stats[pick[1]] += 1
    else: stats['zip'] += 1
json.dump(out, open('data/school-geo-2026-27.json', 'w'), indent=0, sort_keys=True)
print(stats)
