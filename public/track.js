import {$,api,esc,money,date,days,savedOrders} from './common.js';
function card(o){
  return '<article class="panel"><span class="pill">'+esc(o.status)+'</span><h3>'+esc(o.code)+' · '+days[o.kind]+'</h3><p>Ngày giao: '+(o.delivery?date(o.delivery):o.week?'Cuối tuần từ '+date(o.week):'Chưa xếp lịch')+'</p><ul class="plain-list">'+o.lines.map(l=>'<li>'+esc(l.name)+' · '+l.qty+' × '+money(l.price)+'</li>').join('')+'</ul><p><strong>'+money(o.total)+'</strong>'+(o.fee==null?' · Phí giao sẽ xác nhận':'')+'</p><p>Đã thu '+money(o.paid)+' · Còn lại '+money(o.total-o.paid)+'</p>'+(o.deposit?'<p>Mức cọc '+money(o.deposit)+'</p>':'')+'</article>';
}
async function showOrder(){
  const token=location.hash.slice(1), target=$('#order');
  target.replaceChildren();
  if(!token) return;
  try{
    const order=await api('/api/track?token='+encodeURIComponent(token));
    if(token===location.hash.slice(1)) target.innerHTML=card(order);
  } catch(e){ if(token===location.hash.slice(1)) target.textContent=e.message; }
}
const recent=savedOrders(), list=$('#saved-orders');
if(recent.length){
  list.innerHTML='<h2>Đơn đã lưu trên thiết bị này</h2><ul class="plain-list">'+recent.map(o=>'<li><a class="button outline" href="#'+encodeURIComponent(o.token)+'">'+esc(o.code)+' · '+esc(days[o.kind])+'</a></li>').join('')+'</ul>';
  list.hidden=false;
}
window.addEventListener('hashchange',showOrder);
await showOrder();
