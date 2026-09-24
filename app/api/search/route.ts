import {NextRequest,NextResponse} from 'next/server';
import {searchEntries,dictionaryMeta,allEntries} from '@/lib/dictionary-server';
import {dictionaryCategories} from '@/lib/dictionary';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 const q=req.nextUrl.searchParams.get('q')?.trim()||'';
 const category=req.nextUrl.searchParams.get('category')||'Бүгд';
 const offset=Number(req.nextUrl.searchParams.get('offset')||0);
 if(q.length>300||!Number.isInteger(offset)||offset<0||offset>100000||!(category==='Бүгд'||dictionaryCategories.includes(category as typeof dictionaryCategories[number])))return NextResponse.json({error:'Хайлтын утга буруу байна.'},{status:400});
 try {const data=searchEntries(q,category,offset);const counts:Record<string,number>={};for(const e of allEntries())counts[e.category]=(counts[e.category]||0)+1;
 return NextResponse.json({...data,offset,hasMore:offset+24<data.total,meta:{...dictionaryMeta(),available:allEntries().length,categories:counts}},{headers:{'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=86400'}});
 }catch{return NextResponse.json({error:'Өгөгдлийн санг ачаалж чадсангүй. Дахин оролдоно уу.'},{status:503});}
}
