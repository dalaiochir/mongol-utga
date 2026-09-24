import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {allEntries,searchEntries} from '../lib/dictionary-server';
import {GET} from '../app/api/search/route';
import {POST} from '../app/api/explain/route';

test('dictionary preserves unique identifiers, meanings and source attribution',()=>{
 const entries=allEntries();assert.ok(entries.length>=6000);assert.equal(new Set(entries.map(e=>e.id)).size,entries.length);
 for(const entry of entries){assert.ok(entry.word.trim());assert.ok(entry.meanings.length);if(entry.status==='source'){assert.ok(entry.sourceUrl.startsWith('https://'));assert.ok(entry.source);}}
});
test('search ranks exact Mongolian matches first and paginates with stable IDs',()=>{
 const found=searchEntries('ГАР');assert.equal(found.entries[0].word,'гар');assert.equal(found.entries[0].language,'mn');
 const first=searchEntries('','Бүгд',0),second=searchEntries('','Бүгд',24);assert.equal(first.entries.length,24);assert.equal(second.entries.length,24);assert.ok(!second.entries.some(e=>first.entries.some(f=>f.id===e.id)));
 const idioms=searchEntries('','Хэлц үг');assert.ok(idioms.entries.length>0);assert.ok(idioms.entries.every(e=>e.category==='Хэлц үг'));
 assert.equal(searchEntries('nonexistent-term-92187').total,0);
});
test('search endpoint validates category and pagination and returns actual counts',async()=>{
 for(const suffix of ['?offset=-1','?offset=NaN','?category=invalid'])assert.equal((await GET(new NextRequest('https://utga.example/api/search'+suffix))).status,400);
 const response=await GET(new NextRequest('https://utga.example/api/search?q='+encodeURIComponent('гар')));assert.equal(response.status,200);const data=await response.json();assert.equal(data.entries[0].word,'гар');assert.equal(data.meta.available,allEntries().length);
});
function req(body:unknown,headers:Record<string,string>={}){return new NextRequest('https://utga.example/api/explain',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});}
test('explanation endpoint rejects untrusted origins and missing credentials',async()=>{
 assert.equal((await POST(req({query:'гар'},{origin:'https://untrusted.example'}))).status,403);
 assert.equal((await POST(req({query:'гар'}))).status,401);
});
test('AI explanation includes real retrieved sources and does not persist API keys',async()=>{
 const original=globalThis.fetch;let sent:Record<string,unknown>|undefined;
 globalThis.fetch=async(_url,init)=>{sent=JSON.parse(String(init?.body));return Response.json({status:'completed',id:'test-only',model:'test-model',output:[{content:[{type:'output_text',text:JSON.stringify({recognized:true,word:'гар',category:'Үг',meaning:'Тест',literalMeaning:'Тест',usage:'Тест',examples:[{sentence:'Жишээ 1',explanation:'Тест 1'},{sentence:'Жишээ 2',explanation:'Тест 2'}],related:[],caution:''})}]}]});};
 try{const response=await POST(req({query:'гар'},{'x-openai-key':'test-not-a-real-secret-key'}));assert.equal(response.status,200);const data=await response.json();assert.equal(data.explanation.examples.length,2);assert.ok(data.sources.length);assert.ok(data.sources.every((s:{url:string})=>s.url.startsWith('https://')));assert.equal(sent?.store,false);assert.ok(JSON.stringify(sent).includes('referenceEntries'));assert.ok(!JSON.stringify(data).includes('test-not-a-real-secret-key'));}finally{globalThis.fetch=original;}
});
