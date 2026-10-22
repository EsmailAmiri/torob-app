"""Retain only public website/Instagram links; fake phone contacts stay excluded."""
import csv
import io
import json
from pathlib import Path
import zipfile
from urllib.parse import urlparse

root = Path(__file__).resolve().parents[1]
links = {}
with zipfile.ZipFile(root.parent / 'starcoach-dataset-v16-cap300-csv.zip') as archive:
    for row in csv.DictReader(io.TextIOWrapper(archive.open('shops.csv'), encoding='utf-8-sig')):
        entry = {}
        website = row['website_url']
        if urlparse(website).scheme in ('https', 'http'):
            entry['website_url'] = website
        try:
            instagram = json.loads(row['instagram'])
        except (ValueError, TypeError):
            instagram = None
        if isinstance(instagram, dict) and urlparse(instagram.get('profile_url', '')).scheme == 'https':
            entry['instagram'] = instagram['profile_url']
        if entry:
            links[row['shop_id']] = entry
(root / 'src' / 'shop-links.json').write_text(json.dumps(links, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Retained public links for {len(links)} shops; no phone contacts exported.')
