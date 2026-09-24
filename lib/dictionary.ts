import { z } from 'zod';
export const dictionaryCategories = ['Үг', 'Холбоо үг', 'Зүйр үг', 'Хэлц үг', 'Ёгтлол', 'Монгол ахуй'] as const;
export type Entry = {id:string;word:string;category:typeof dictionaryCategories[number];meanings:string[];examples:{sentence:string;explanation:string}[];related:string[];source:string;sourceUrl:string;revision?:number;language:'mn'|'en';status:'source'|'editorial';parent?:string;aliases?:string[]};
export function normalize(value:string){return value.normalize('NFKC').toLocaleLowerCase('mn').replace(/[“”„"'‘’.,!?;:]/g,'').replace(/\s+/g,' ').trim();}
export function rank(entry:Entry,query:string){const q=normalize(query),word=normalize(entry.word);if(!q)return 1;if(word===q)return 100;if(entry.aliases?.some(a=>normalize(a)===q))return 95;if(word.startsWith(q))return 80;if(word.includes(q))return 65;const tokens=q.split(' ');if(tokens.every(t=>word.includes(t)))return 50;if(entry.meanings.some(m=>normalize(m).includes(q)))return 20;return 0;}
export const explanationSchema=z.object({recognized:z.boolean(),word:z.string(),category:z.string(),meaning:z.string(),literalMeaning:z.string(),usage:z.string(),examples:z.array(z.object({sentence:z.string(),explanation:z.string()})).max(4),related:z.array(z.string()).max(8),caution:z.string()});
export type Explanation=z.infer<typeof explanationSchema>;
