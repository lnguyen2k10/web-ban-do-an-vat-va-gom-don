export const $=(s,scope=document)=>scope.querySelector(s);
export const esc=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
export const money=v=>new Intl.NumberFormat('vi-VN').format(v??0)+' ₫';
export const date=v=>v?String(v).slice(0,10).split('-').reverse().join('/'):'Chưa xếp lịch';
export async function api(path,data,method=data===undefined?'GET':'POST'){
  const binary=data instanceof Blob;
  const r=await fetch(path,{method,headers:data===undefined?{}:{'Content-Type':binary?'application/octet-stream':'application/json'},body:data===undefined?undefined:binary?data:JSON.stringify(data)});
  const out=await r.json();
  if(!r.ok) throw Object.assign(new Error(out.error),{status:r.status});
  return out;
}
export const pairs=form=>Object.fromEntries(new FormData(form));
export const days={daily:'Ăn vặt',weekly:'Món gom'};

const receiptsKey='lees-order-links';
export function savedOrders() {
  try {
    const entries=JSON.parse(localStorage.getItem(receiptsKey));
    return Array.isArray(entries)?entries.filter(o=>o&&/^[\w-]{32}$/.test(o.token)&&typeof o.code==='string').slice(0,30):[];
  } catch { return []; }
}
export function rememberOrders(orders) {
  const recent=[...orders].reverse().map(({token,code,kind,created})=>({token,code,kind,created}));
  try {
    const currentTokens=new Set(recent.map(o=>o.token));
    const entries=[...recent,...savedOrders().filter(o=>!currentTokens.has(o.token))];
    localStorage.setItem(receiptsKey,JSON.stringify(entries.slice(0,30)));
  } catch { /* The links are still shown on the receipt. */ }
}
