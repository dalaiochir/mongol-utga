import fs from 'node:fs';
import path from 'node:path';
import { seedItems } from './seed';
import { rank, normalize, type Entry } from './dictionary';
let cached:Entry[]|undefined;
export function allEntries():Entry[]{
 if(cached)return cached;
 const folder=path.join(process.cwd(),'data');
 const data=fs.readdirSync(folder).filter(f=>/^dictionary-\d+\.json$/.test(f)).sort().flatMap(file=>JSON.parse(fs.readFileSync(path.join(folder,file),'utf8')) as Entry[]);
 const existing=new Set(data.filter(e=>e.language==='mn').map(e=>normalize(e.word)));
 const editorial:Entry[]=seedItems.filter(i=>!existing.has(normalize(i.text))).map(i=>({id:i.id,word:i.text,category:i.category,meanings:[i.expected],examples:[{sentence:i.context,explanation:i.expected}],related:[],source:'Утга · редакцын эхлэх жишээ, шинжээчээр хянаагүй',sourceUrl:'',language:'mn',status:'editorial'}));
 cached=[...editorial,...data];return cached;
}
export function searchEntries(query:string,category='Бүгд',offset=0){
 const ranked=allEntries().filter(e=>category==='Бүгд'||e.category===category).map(entry=>({entry,score:rank(entry,query)})).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||(a.entry.language==='mn'?0:1)-(b.entry.language==='mn'?0:1)||a.entry.word.localeCompare(b.entry.word,'mn'));
 return {total:ranked.length,entries:ranked.slice(offset,offset+24).map(x=>x.entry)};
}
export function dictionaryMeta(){return JSON.parse(fs.readFileSync(path.join(process.cwd(),'data/metadata.json'),'utf8'));}
