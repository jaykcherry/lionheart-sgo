"""Builds prototype/schools.js and data/*.json from the TDOE-derived school list (data/tn-private-schools-2026-27.psv).
Needs: pip install zipcodes"""
import csv, json, re, zipcodes
rows = list(csv.DictReader(open('data/tn-private-schools-2026-27.psv'), delimiter='|'))
# Stable IDs used by the prototype's demo portals.
DEMO = {'Christ Presbyterian Academy': 'cpa', 'Davidson Academy': 'da', 'Donelson Christian Academy': 'dca', 'Ezell-Harding Christian School': 'ehcs', 'Goodpasture Christian School': 'gcs', 'Lipscomb Academy': 'la', 'Nashville Christian School: Charlotte Pike': 'ncs', 'Friendship Christian School': 'fcs', 'Brentwood Academy': 'ba', 'Middle Tennessee Christian School': 'mtcs', 'Briarcrest Christian School': 'bcs', 'Evangelical Christian School - Middle & Upper School': 'ecs'}
# Email domains that can't prove someone works at a specific school.
GENERIC = {'gmail.com', 'yahoo.com', 'hotmail.com', 'me.com', 'gccsda.com', 'gccsda.org', 'kytn.net', 'outlook.com', 'icloud.com', 'aol.com', 'comcast.net', 'att.net', 'charter.net', 'musfiber.com', 'benlomand.net', 'highland.net', 'nctc.com'}
WEST = {'Shelby', 'Fayette', 'Tipton', 'Madison', 'Hardin', 'Weakley', 'Dyer', 'Crockett', 'Benton', 'Henry', 'Lauderdale', 'McNairy', 'Henderson', 'Decatur', 'Haywood', 'Hardeman', 'Chester', 'Carroll', 'Gibson', 'Obion', 'Lake'}
EAST = {'Blount', 'Knox', 'Hamilton', 'Hamblen', 'Jefferson', 'Sullivan', 'Washington', 'Carter', 'Greene', 'Sevier', 'Bradley', 'McMinn', 'Loudon', 'Anderson', 'Campbell', 'Claiborne', 'Rhea', 'Marion', 'Sequatchie', 'Cumberland', 'Morgan', 'Monroe', 'Roane', 'Scott', 'Bledsoe', 'Cocke', 'Grainger', 'Hancock', 'Hawkins', 'Johnson', 'Meigs', 'Polk', 'Unicoi', 'Union'}
# Website hosts shared by many unrelated sites: an email there proves nothing about the school.
SHARED = {'weebly.com', 'flywheelsites.com', 'wixsite.com', 'squarespace.com', 'wordpress.com', 'blogspot.com', 'facebook.com', 'google.com', 'godaddysites.com', 'webflow.io'}
def root(host):
    host = host.split('/')[0].lower()
    if not host or 'adventistschoolconnect' in host: return ''
    p = host.split('.')
    d = '.'.join(p[-3:]) if host.endswith('.tn.org') else '.'.join(p[-2:])
    return '' if d in SHARED else d
# Official contacts from the TDOE directory (E-mail and Alternate E-mail columns). Kept out of the public repo:
# data/private/tdoe-contacts-2026-27.psv, one row per line of the school list above (row = 0-based index).
import os
CONTACTS = {}
if os.path.exists('data/private/tdoe-contacts-2026-27.psv'):
    for c in csv.DictReader(open('data/private/tdoe-contacts-2026-27.psv'), delimiter='|'):
        CONTACTS[int(c['row'])] = c
def mask(e):
    local, _, dom = e.partition('@')
    return (local[:2] if len(local) > 3 else local[:1]) + '•••@' + dom
# Street-level coordinates (scripts/geocode-schools.py output): OpenStreetMap school POIs, else US Census address match.
# Falls back to the ZIP centroid for anything not geocoded.
GEO = json.load(open('data/school-geo-2026-27.json')) if os.path.exists('data/school-geo-2026-27.json') else {}
seen, out, contact_sql = {}, [], []
for i, r in enumerate(rows):
    sid = DEMO.get(r['name']) or re.sub(r'[^a-z0-9]+', '-', r['name'].lower()).strip('-')[:40]
    if sid in seen: seen[sid] += 1; sid = f'{sid}-{seen[sid]}'
    else: seen[sid] = 1
    z = zipcodes.matching(r['zip'])[0]
    dom = root(r['website']); em = r['email_domain']
    alt = em if em and em not in GENERIC and em != dom else ''
    if not dom and alt: dom, alt = alt, ''
    reg = 'West' if r['county'] in WEST else 'East' if r['county'] in EAST else 'Middle'
    out.append({'id': sid, 'name': r['name'], 'city': r['city'], 'county': r['county'], 'zip': r['zip'], 'region': reg, 'cat': r['category'], 'auth': r['authorizer'], 'grades': r['grades'], 'k12': int(r['k12_students'] or 0), 'site': r['website'], 'domain': dom, 'alt': alt, 'lat': GEO[sid]['lat'] if sid in GEO else round(float(z['lat']), 3), 'lon': GEO[sid]['lon'] if sid in GEO else round(float(z['long']), 3), 'geo': GEO[sid]['src'] if sid in GEO else 'zip', 'umbrella': r.get('umbrella_option') == 'yes'})
    c = CONTACTS.get(i)
    if c:
        emails = [e.strip().lower() for e in (c['email'], c['alt_email']) if e.strip()]
        emails = [e for k, e in enumerate(emails) if e not in emails[:k]]
        out[-1]['vm'] = [mask(e) for e in emails]          # masked, for display only
        out[-1]['street'] = c['street']
        for k, e in enumerate(emails):
            q = lambda v: "'" + v.replace("'", "''") + "'"
            contact_sql.append(f"insert into school_contacts (school_id, email, kind, source) select id, {q(e)}, {q('primary' if k == 0 else 'alternate')}, 'TDOE Non-Public Schools Directory 2026-27' from schools where slug = {q(sid)} on conflict do nothing;")
open('prototype/schools.js', 'w').write('/* Tennessee Department of Education, Non-Public Schools Directory 2026-27 (updated Oct 5, 2026): private K-12 schools in Categories I-V (homeschool-umbrella-only programs excluded) with a Tennessee address. Generated by scripts/build-schools.py. */\nwindow.LH_SCHOOLS = ' + json.dumps(out, separators=(',', ':'), ensure_ascii=False) + ';\n')
open('data/tn-private-schools-2026-27.json', 'w').write(json.dumps(out, indent=1, ensure_ascii=False))
q = lambda v: 'null' if v in (None, '') else "'" + str(v).replace("'", "''") + "'"
vals = ',\n'.join(f"({q(o['id'])}, {q(o['name'])}, {q(o['city'])}, {q(o['grades'])}, {q(o['domain'])}, {q(o['alt'])}, {q(o['auth'])}, {q(o['county'])}, {q(o['region'])}, {q(o['cat'])})" for o in out)
open('supabase/seed-schools.sql', 'w').write('-- Generated from data/tn-private-schools-2026-27.json (TDOE Non-Public Schools Directory 2026-27, private K-12 schools, Categories I-V).\n-- Run after migrations: psql $DATABASE_URL -f supabase/seed-schools.sql\ninsert into schools (slug, name, city, grades, email_domain, alt_email_domain, accreditor, county, region, tdoe_category) values\n' + vals + '\non conflict (slug) do update set name = excluded.name, city = excluded.city, grades = excluded.grades, email_domain = excluded.email_domain, alt_email_domain = excluded.alt_email_domain, accreditor = excluded.accreditor, county = excluded.county, region = excluded.region, tdoe_category = excluded.tdoe_category;\n')
if contact_sql:
    open('supabase/seed-school-contacts.sql', 'w').write('-- Generated by scripts/build-schools.py from data/private/ (not committed). Official school contact emails from the TDOE directory.\n' + '\n'.join(contact_sql) + '\n')
print(len(out), 'schools,', len(CONTACTS), 'with directory contacts')
