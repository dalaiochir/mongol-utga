import urllib.request,urllib.parse,json,time,concurrent.futures,pathlib,sys
BASE='https://mn.wiktionary.org/w/api.php'
ROOT=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '.dictionary-cache');ROOT.mkdir(exist_ok=True)
def get(params):
 params={'format':'json','formatversion':'2','maxlag':'5',**params}
 u=BASE+'?'+urllib.parse.urlencode(params)
 for attempt in range(3):
  try:
   req=urllib.request.Request(u,headers={'User-Agent':'MongolUtga/1.0 (https://github.com/dalaiochir/mongol-utga; open dictionary research)'})
   with urllib.request.urlopen(req,timeout=30) as r:d=json.load(r)
   if 'error' in d:raise RuntimeError(d['error'].get('code'))
   return d
  except Exception:
   if attempt==2:raise
   time.sleep(2*(attempt+1))
titles=[];cont={}
while True:
 d=get({'action':'query','list':'allpages','apnamespace':0,'aplimit':500,'apfilterredir':'nonredirects',**cont})
 titles.extend(p['title'] for p in d['query']['allpages'])
 cont=d.get('continue');print('Indexed',len(titles),flush=True)
 if not cont:break
(ROOT/'titles.json').write_text(json.dumps(titles,ensure_ascii=False))
batches=[titles[i:i+50] for i in range(0,len(titles),50)]
def fetch(args):
 idx,batch=args;p=ROOT/f'batch-{idx:04}.json'
 if p.exists():return idx
 d=get({'action':'query','prop':'revisions','rvprop':'ids|content','rvslots':'main','titles':'|'.join(batch)})
 p.write_text(json.dumps(d,ensure_ascii=False));return idx
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for n,idx in enumerate(pool.map(fetch,enumerate(batches)),1):
  if n%10==0:print('Downloaded batches',n,'/',len(batches),flush=True)
print('DONE',len(titles),flush=True)
