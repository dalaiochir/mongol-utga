"""Convert open Wikimedia data into attributed, plain-text dictionary records.
Usage: python scripts/build-dictionary.py /path/to/wiki-cache /path/to/mn-kaikki.jsonl
Source texts and adaptations: CC BY-SA 4.0. No expert-verification claim.
"""
import json,re,html,sys,hashlib,pathlib,collections,datetime
cache=pathlib.Path(sys.argv[1]);fallback=pathlib.Path(sys.argv[2]);out=pathlib.Path('data');out.mkdir(exist_ok=True)
def clean(t):
 t=re.sub(r'<ref\b[^>]*>.*?</ref>','',t,flags=re.S)
 t=re.sub(r'\[\[(?:Ангилал|Category|Файл|File):[^]]*\]\]','',t,flags=re.I)
 t=re.sub(r'\[\[([^]|]+)\|([^]]+)\]\]',r'\2',t)
 t=re.sub(r'\[\[([^]]+)\]\]',r'\1',t)
 t=re.sub(r'\[https?://\S+\s+([^]]+)\]',r'\1',t)
 for _ in range(4):t=re.sub(r'\{\{[^{}]*\}\}','',t)
 t=re.sub(r'<[^>]+>',' ',t);t=t.replace("'",'')
 return re.sub(r'\s+',' ',html.unescape(t)).strip(' :#*;\t')
def ident(s):return hashlib.sha1(s.encode()).hexdigest()[:16]
entries={}
cultural_words=set('гэр тооно унь хана багана өрх туурга хаяавч хошлон бүслүүр үүд эсгий ширдэг авдар хоймор тотго босго тулга зуух аргамж уурга бугуйл чөдөр ногт хазаар эмээл дөрөө ганзага гөлөм тохом хом хөтөл сааль айраг ааруул өрөм ээзгий тараг хоормог бүлүүр хөхүүр хөхүүрийн домбо борц боорцог бууз хуушуур шагай оньс хорол хөөрөг даалин хадаг дээл бүс малгай гутал золгох золголт наадам овоо тахилга отор нутаг нүүдэл хот айл хотол малчин адуучин хоньчин тэмээчин үхэрчин хурга ишиг унага тугал ботго даага шүдлэн хязаалан соёолон хонин адуу тэмээ сарлаг хайнаг цагаан идээ'.split())
for file in sorted(cache.glob('batch-*.json')):
 d=json.load(open(file))
 for page in d.get('query',{}).get('pages',[]):
  if not page.get('revisions'):continue
  title=page['title'];rev=page['revisions'][0];raw=rev['slots']['main'].get('content',rev['slots']['main'].get('*',''))
  if not re.search(r'Монголоор|\{\{[-=]?mn[-=]?\}\}',raw,re.I):continue
  if not re.search('[А-Яа-яӨөҮүЁё]',title):continue
  if len(title)>200:continue
  sections=re.split(r'^\s*={2,}\s*(.*?)\s*={2,}\s*$',raw,flags=re.M)
  senses=[];phrases=[]
  for i in range(1,len(sections)-1,2):
   heading=clean(sections[i]);body=sections[i+1]
   if any(w in heading for w in ['Зүйр','Цэцэн','Хэвшмэл']):
    for block in re.split(r'\n\s*\n',body):
     explained=re.search(r'Тайлбар\s*:\s*(.+)',block,re.S)
     if explained:
      lines=[clean(line) for line in block[:explained.start()].splitlines() if clean(line)]
      word=' '.join(lines);meaning=clean(explained[1])
      if 5<len(word)<300 and len(meaning)>4:phrases.append((word,meaning,'Зүйр үг'))
   if heading in ['Үгийн утга','Утга','Үгийн тайлбар']:
    for line in body.splitlines():
     if re.match(r'\s*[:]*#(?![:*])',line):
      value=clean(line)
      if len(value)>3 and '{{' not in value:senses.append(value)
   if any(w in heading for w in ['Нийлмэл','Хоршоо','Өвөрмөц хэлц','Хэвшмэл хэлц','Хэлц үг','Зүйр']):
    cat='Зүйр үг' if any(w in heading for w in ['Хэвшмэл','Зүйр']) else 'Хэлц үг' if 'хэлц' in heading.lower() else 'Холбоо үг'
    for line in body.splitlines():
     # Keep only explicitly defined phrase pairs. Do not infer meanings from verse.
     m=re.match(r"\s*[:*#]*\s*'''\s*(.+?)\s*'''\s*[-–—=]\s*(.+)",line)
     if not m:continue
     word,meaning=clean(m[1]),clean(m[2])
     if 2<len(word)<180 and len(meaning)>4 and '{{' not in meaning:phrases.append((word,meaning,cat))
  url='https://mn.wiktionary.org/w/index.php?oldid='+str(rev['revid'])
  base={'source':'Монгол Викитоль · хувь нэмэр оруулагчид','sourceUrl':url,'revision':rev['revid'],'language':'mn','status':'source','aliases':[]}
  if senses:
   key='mn:'+title
   entries[key]={'id':ident(key),'word':title,'category':'Монгол ахуй' if title in cultural_words else 'Үг','meanings':list(dict.fromkeys(senses)),'examples':[{'sentence':p[0],'explanation':p[1]} for p in phrases[:12]],'related':list(dict.fromkeys(p[0] for p in phrases))[:20],**base}
  for word,meaning,cat in phrases:
   examples=[]
   if '~' in meaning:
    definition,sentence=meaning.split('~',1)
    if definition.strip() and sentence.strip():
     meaning=definition.strip();examples=[{'sentence':sentence.strip(),'explanation':meaning}]
   key='mn:'+word
   if key in entries:
    if meaning not in entries[key]['meanings']:entries[key]['meanings'].append(meaning)
    entries[key]['examples'].extend(e for e in examples if e not in entries[key]['examples'])
    if cat=='Хэлц үг' and entries[key]['category']=='Холбоо үг':entries[key]['category']=cat
   else:entries[key]={'id':ident(key),'word':word,'category':cat,'meanings':[meaning],'examples':examples,'related':[title],'parent':title,**base}
# Fallback: English-language explanations, explicitly labeled, never passed off as Mongolian.
from urllib.parse import quote
for line in open(fallback):
 r=json.loads(line);word=r['word'];key='en:'+word
 if 'mn:'+word in entries:continue
 glosses=[g for sense in r.get('senses',[]) for g in sense.get('glosses',[]) if g]
 if not glosses:continue
 examples=[{'sentence':e['text'],'explanation':e.get('english',e.get('translation',''))} for s in r.get('senses',[]) for e in s.get('examples',[]) if e.get('text')]
 aliases=[f['form'] for f in r.get('forms',[]) if 'romanization' in f.get('tags',[])]
 if key in entries:
  entries[key]['meanings']=list(dict.fromkeys(entries[key]['meanings']+glosses));continue
 entries[key]={'id':ident(key),'word':word,'category':'Зүйр үг' if r.get('pos')=='proverb' else 'Холбоо үг' if r.get('pos')=='phrase' else 'Үг','meanings':glosses,'examples':examples[:8],'related':[],'aliases':aliases,'source':'English Wiktionary · Kaikki / Wiktextract','sourceUrl':'https://en.wiktionary.org/wiki/'+quote(word)+'#Mongolian','language':'en','status':'source'}
records=sorted(entries.values(),key=lambda x:(x['language']!='mn',x['word']))
for p in out.glob('dictionary-*.json'):p.unlink()
for i in range(0,len(records),300):
 (out/f'dictionary-{i//300:03}.json').write_text(json.dumps(records[i:i+300],ensure_ascii=False,separators=(',',':')))
meta={'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'total':len(records),'mongolian':sum(e['language']=='mn' for e in records),'english':sum(e['language']=='en' for e in records),'categories':dict(collections.Counter(e['category'] for e in records)),'pagesDownloaded':sum(len(json.load(open(f)).get('query',{}).get('pages',[])) for f in cache.glob('batch-*.json')),'license':'CC BY-SA 4.0','licenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/','changes':'Wikitext markup removed; explicitly defined phrase pairs extracted; records deduplicated. Explanations not machine-translated.'}
(out/'metadata.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2));print(json.dumps(meta,ensure_ascii=False))
