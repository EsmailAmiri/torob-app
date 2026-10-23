"""Import the complete verified catalogue into local SQLite. Never commit runtime DBs."""
import pathlib,sqlite3,json,gzip,re,sys,time,os
sys.stdout.reconfigure(encoding='utf-8')
root=pathlib.Path(__file__).resolve().parents[1]
target=pathlib.Path(os.environ.get('DATABASE_PATH',str(root/'runtime'/'torob.sqlite')));target.parent.mkdir(parents=True,exist_ok=True)
db=sqlite3.connect(target)
db.execute('PRAGMA journal_mode=WAL')
db.execute('CREATE TABLE IF NOT EXISTS __local_migrations(name TEXT PRIMARY KEY)')
applied={row[0] for row in db.execute('SELECT name FROM __local_migrations')}
for migration in sorted((root/'drizzle').glob('*.sql')):
 if migration.name not in applied:
  db.executescript(migration.read_text(encoding='utf-8'))
  db.execute('INSERT INTO __local_migrations VALUES(?)',(migration.name,));db.commit()
def normalize(s):
 return re.sub(r'\s+',' ',s.lower().translate(str.maketrans('يك۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩','یک01234567890123456789')).replace('\u200c',' ').replace('\u200e',' ').replace('\u200f',' ')).strip()
data=root/'public'/'data'
def read(p):return json.loads(gzip.decompress(p.read_bytes()))
shops=read(data/'shops.json.gz')
db.executemany('INSERT INTO shops(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',[(sid,json.dumps(s,ensure_ascii=False,separators=(',',':'))) for sid,s in shops.items()])
db.execute('INSERT OR REPLACE INTO catalogue_imports VALUES(?,?,?)',('shops',len(shops),int(time.time()*1000)))
for i,path in enumerate(sorted(data.glob('products-*.json.gz'))):
 products=read(path);rows=[]
 for pid,p in products.items():
  summary={k:v for k,v in p.items() if k not in ['specs','offers']}
  rows.append((pid,p['title'],p['category'],str(p['brand']) if p['brand'] is not None else None,p['price'],p['count'],normalize(p['title']+' '+p['category']+' '+str(p['brand'] or '')),json.dumps(summary,ensure_ascii=False,separators=(',',':')),json.dumps(p,ensure_ascii=False,separators=(',',':'))))
 db.executemany('INSERT INTO products VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,category=excluded.category,brand=excluded.brand,price=excluded.price,offer_count=excluded.offer_count,search=excluded.search,summary=excluded.summary,detail=excluded.detail',rows)
 db.execute('INSERT OR REPLACE INTO catalogue_imports VALUES(?,?,?)',(path.name[9:11],len(rows),int(time.time()*1000)))
 if i%32==31:db.commit();print('Imported',i+1,'/256 shards',flush=True)
db.commit()
count=db.execute('SELECT COUNT(*) FROM products').fetchone()[0]
assert count==225903
print('SQLite ready:',count,'products,',len(shops),'shops')
db.execute('PRAGMA wal_checkpoint(TRUNCATE)')
db.execute('PRAGMA journal_mode=DELETE')
db.close()
