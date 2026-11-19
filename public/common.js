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
