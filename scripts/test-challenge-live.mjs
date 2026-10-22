import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const results = [];
async function api(path, body) {
  const r = await fetch(base + '/api' + path, body ? { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(body), signal: AbortSignal.timeout(110000) } : {});
  return { status:r.status, data:await r.json() };
}
async function chat(name, message, context = {}, threadId = randomUUID()) {
  const started = Date.now();
  const requestId = randomUUID();
  try {
    const response = await api('/chat', {threadId, requestId, message, context});
    const result = {name, message, context, threadId, requestId, durationMs:Date.now()-started, ...response};
    results.push(result);
    await writeFile('runtime/challenge-live-partial.json', JSON.stringify(results,null,2));
    console.log(JSON.stringify({name,status:result.status,durationMs:result.durationMs,text:result.data.text,tools:result.data.tools,actions:result.data.actions?.map(a=>a.type)}));
    return result;
  } catch(e) {
    const result = {name, message, context, threadId, requestId, durationMs:Date.now()-started, error:e.name};
    results.push(result);
    await writeFile('runtime/challenge-live-partial.json', JSON.stringify(results,null,2));
    console.log(JSON.stringify(result)); return result;
  }
}
await mkdir('runtime', {recursive:true});
console.log(JSON.stringify({health:await api('/health')}));
const search = await api('/products?query=A56&limit=3');
const products = search.data.products;
if (!products?.length) throw Error('Seed search returned no products');
const selectedId = products[0].id;
const context = {query:'A56', selectedId, place:'جمهوری', radius:30};
await chat('01-clarify-need','یک کتونی برای پیاده‌روی طولانی می‌خوام ولی نمی‌دونم چه مدلی بخرم. کمکم کن.', {query:''});
await chat('02-dataset-recommendation','گوشی سامسونگ A56 تا ۶۰ میلیون تومان می‌خوام. حتماً گزینه‌های موجود در دیتاست رو پیدا کن و پیشنهاد بده.', {query:'A56'});
await chat('03-compare','این دو محصول انتخاب‌شده را از نظر مشخصات و قیمت مقایسه کن و بگو برای عکاسی کدام بهتر است.', {...context, compareIds:products.slice(0,2).map(p=>p.id)});
await chat('04-sellers','فروشنده‌های این محصول را نزدیک جمهوری پیدا و از نظر قیمت، فاصله و ساعت کاری مقایسه کن. آدرس دقیق داخل پاساژ را اگر ثبت شده بگو.', context);
await chat('05-credit-open','همین محصول را فقط از فروشگاه‌های دارای خرید قسطی و الان باز، در شعاع ۵ کیلومتری جمهوری می‌خواهم. نامشخص‌ها را تأییدشده حساب نکن.', context);
await chat('06-inquiry','برای این محصول یکی از فروشنده‌ها را پیدا کن و استعلام آزمایشی قیمت و موجودی بگیر. می‌دانم شماره‌ها جعلی‌اند.', context);
await chat('07-alternative','فروشنده‌ای که انتخاب کردم جواب نداد؛ برای همین محصول فروشنده جایگزین و مدل مشابه پیشنهاد بده، نزدیک جمهوری و با سقف ۶۰ میلیون.', {...context,budget:60000000});
await chat('08-missing-market-map','دوربین فیلمبرداری آنالوگ Bolex H16 Rex-5 می‌خواهم. اول دیتاست را جستجو کن. اگر پیدا نشد بگو در تهران کدام ناحیه یا بورس را بگردم و یک ویجت لوکیشن روی نقشه بفرست؛ معلوم کن کدام اطلاعات خارج دیتاست است.', {query:'',selectedId:null});
await chat('09-unsupported-neighbourhood','این محصول را نزدیک نارمک می‌خواهم، محدوده را تغییر بده و فروشنده نزدیک پیشنهاد کن.', context);
const sellers = await api('/sellers', {productId:selectedId,place:'جمهوری',radius:30});
const offer = sellers.data.offers?.[0];
if (offer) {
 const inquiry = await api('/inquiries',{threadId:randomUUID(),requestId:randomUUID(),productId:selectedId,offerId:offer.id});
 const simulations = [];
 for (const status of ['available_demo','unavailable_demo','noanswer_demo']) simulations.push(await api('/inquiries/'+inquiry.data.id+'/simulate',{status}));
 results.push({name:'10-inquiry-api-scenarios',inquiry,simulations});
}
const catalogue = {searchTotal:search.data.total,products:products.map(p=>({id:p.id,title:p.title,price:p.price})),sellerTotal:sellers.data.total};
await writeFile('runtime/challenge-live-results.json', JSON.stringify({date:new Date().toISOString(),base,catalogue,results},null,2));
console.log('REPORT: runtime/challenge-live-results.json');
