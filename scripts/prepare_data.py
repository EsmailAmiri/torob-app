"""Build a complete static catalogue from the challenge archive. No invented offers."""
import csv, io, json, zipfile, pathlib, collections, sys, gzip
sys.stdout.reconfigure(encoding='utf-8')
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'data'
OUT.mkdir(parents=True, exist_ok=True)
def parse(v):
    try: return json.loads(v)
    except (ValueError, TypeError): return v
def write(name, data):
    raw=json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    if name in ['featured.json','meta.json']:
        (OUT/name).write_bytes(raw)
    else:
        (OUT/(name+'.gz')).write_bytes(gzip.compress(raw,compresslevel=6,mtime=0))
        if (OUT/name).exists(): (OUT/name).unlink()
with zipfile.ZipFile(ROOT.parent / 'starcoach-dataset-v16-cap300-csv.zip') as z:
    def rows(name): return csv.DictReader(io.TextIOWrapper(z.open(name+'.csv'),encoding='utf-8-sig'))
    shops = {r['shop_id']: {k:parse(v) for k,v in r.items() if k not in ['contacts','instagram','website_url']} for r in rows('shops')}
    offers = collections.defaultdict(list)
    for r in rows('offers'):
        offers[r['product_id']].append({'id':r['offer_id'],'shop':r['shop_id'],'price':parse(r['price_toman']),'changed':parse(r['last_price_changed_at']),'title':r['seller_title'],'warranty':parse(r['warranty']),'description':r['description']})
    shards = collections.defaultdict(dict)
    search, featured, categories = [], [], collections.Counter()
    for r in rows('products'):
        pid = r['product_id']; oo = offers[pid]; prices = [o['price'] for o in oo if isinstance(o['price'],(int,float)) and o['price']>0]
        images=parse(r['image_urls']) or []
        p={'id':pid,'title':r['persian_title'] or 'محصول بدون عنوان','category':r['category_name'],'brand':parse(r['brand_name']),'image':images[0] if images else None,'price':min(prices) if prices else None,'maxPrice':max(prices) if prices else None,'count':len(oo)}
        categories[p['category']]+=1
        search.append(p)
        shards[pid[-2:]][pid] = {**p,'specs':parse(r['specs']) or [],'offers':oo}
        if p['category']=='گوشی موبایل' and p['price'] and p['image'] and p['count']>=3: featured.append(p)
    for key,data in shards.items(): write('products-'+key+'.json',data)
    featured.sort(key=lambda p:(not any(s in p['title'].lower() for s in ['a56','a36','a16','note 14','iphone 16','s25']),-p['count']))
    write('featured.json',featured[:36] or sorted((p for p in search if p['image'] and p['price']),key=lambda p:-p['count'])[:36])
    write('search.json',search)
    write('shops.json',shops)
    write('meta.json',{'products':len(search),'shops':len(shops),'offers':sum(map(len,offers.values())),'categories':categories.most_common(),'source':'starcoach-dataset-v16-cap300-csv.zip'})
    print('Prepared',len(search),'products,',len(shops),'shops; all offers retained. Featured:',len(featured))
