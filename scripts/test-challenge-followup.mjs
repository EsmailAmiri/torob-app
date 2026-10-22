import { readFile,writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
const base='http://127.0.0.1:8787/api';
const report=JSON.parse(await readFile('runtime/challenge-live-results.json','utf8'));
const db=new DatabaseSync('runtime/torob.sqlite',{readOnly:true});
const results=[];
async function send(name,message,context,threadId=randomUUID(),requestId=randomUUID()) {
 const start=Date.now();
 const r=await fetch(base+'/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({threadId,requestId,message,context}),signal:AbortSignal.timeout(110000)});
 const result={name,status:r.status,durationMs:Date.now()-start,threadId,requestId,message,context,data:await r.json()};
 results.push(result);await writeFile('runtime/challenge-followup-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({name,status:result.status,durationMs:result.durationMs,text:result.data.text,tools:result.data.tools}));return result;
}
for(const test of report.results.filter(x=>x.status===503)) {
 const state=JSON.parse(db.prepare('SELECT state FROM sessions WHERE id=?').get(test.threadId).state);
 console.log(JSON.stringify({name:test.name,diagnostic:{rounds:state.pending?.rounds,stage:state.pending?.stage,tools:state.pending?.tools,calls:state.pending?.input.filter(x=>x.type==='function_call').map(x=>({name:x.name,args:JSON.parse(x.arguments)}))}}));
 await send(test.name+'-retry',test.message,test.context,test.threadId,state.pending.requestId);
}
const a=await send('11-existing-product-150m','گوشی سامسونگ A56 با بودجه ۱۵۰ میلیون تومان می‌خواهم، گزینه‌های خود گوشی را از دیتاست پیشنهاد بده نه قاب و قطعات.',{query:'A56'});
if(a.status===200) await send('12-multiturn-budget-change','بودجه‌ام را به ۶۰ میلیون کاهش بده. اگر A56 نمی‌شود، گوشی واقعی دیگری از همین دیتاست پیشنهاد بده؛ لوازم جانبی معرفی نکن.',{query:'A56',budget:150000000},a.threadId);
const p=report.catalogue.products[0];
await send('13-selected-without-budget','این محصول انتخابی را از کجا نزدیک جمهوری حضوری بخرم؟ سه گزینه پیشنهاد بده و قیمت‌ها را دقیقاً به تومان بگو.',{query:'A56',selectedId:p.id,place:'جمهوری',radius:5});
db.close();
