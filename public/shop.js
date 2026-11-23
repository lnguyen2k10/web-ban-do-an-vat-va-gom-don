import {$,esc,money,date,api,pairs,days,rememberOrders} from './common.js';
const cart=$('#cart'),details=$('#details'), addToast=$('#toast');
const groupLink=new URL(location.href).searchParams.get('cum')||'';
let data,selectedGroup=groupLink, buyer={}, bag;
try{bag=JSON.parse(localStorage.getItem('lees-cart'))||{};}catch{bag={};}
const items=()=>data.products.filter(p=>bag[p.id]>0);
const canBuy=p=>data.schedule[p.kind];
const price=p=>p.promo??p.price;
let timer, lastCheckout;
function toast(s){addToast.textContent=s;addToast.hidden=false;clearTimeout(timer);timer=setTimeout(()=>addToast.hidden=true,1600);}
function save(){
  try { localStorage.setItem('lees-cart',JSON.stringify(bag)); } catch { /* The cart remains available in this tab. */ }
  $('#count').textContent=items().reduce((t,p)=>t+bag[p.id],0);
}
function increment(id,step){
  const p=data.products.find(p=>p.id===id);
  if(!p||(step>0&&!canBuy(p))) return;
  bag[id]=Math.max(0,Math.min(99,(Number(bag[id])||0)+step));
  save();
}
function product(p){
  return '<article class="card"><button class="image-button" data-detail="'+p.id+'" aria-label="Xem '+esc(p.name)+'"><img loading="lazy" src="'+esc(p.images[0])+'" alt="'+esc(p.name)+'"></button><div class="card-content"><h3>'+esc(p.name)+'</h3><p>'+esc(p.unit)+' · '+esc(p.description)+'</p><div class="price-line"><span class="price">'+money(price(p))+(p.promo==null?'':' <del>'+money(p.price)+'</del>')+'</span><button class="button '+(canBuy(p)?'olive':'outline')+'" data-add="'+p.id+'" '+(canBuy(p)?'':'disabled')+'> '+(canBuy(p)?'Thêm':'Đã chốt')+'</button></div></div></article>';
}
function render(){
  for(const kind of Object.keys(days)) $('#'+kind+'-grid').innerHTML=data.products.filter(p=>p.kind===kind).map(product).join('')||'<p>Chưa có món đang bán.</p>';
  $('#daily-window').textContent=data.schedule.daily?'Đang nhận đơn hôm nay đến 17h':'Đã chốt đơn hôm nay';
  $('#weekly-window').textContent=(data.schedule.weekly?'Đang nhận đơn · Giao ':'Đợt nhận đơn tiếp theo giao ')+date(data.schedule.saturday)+' – '+date(data.schedule.sunday);
  $('#group-grid').innerHTML=data.groups.map(g=>'<article class="card group-card"><h3>'+esc(g.name)+'</h3><p>'+esc(g.area)+'</p><a class="button outline" href="/dat-hang?cum='+encodeURIComponent(g.id)+'#daily">Đặt theo cụm</a>'+(g.zalo?'<a class="button olive" target="_blank" rel="noopener" href="'+esc(g.zalo)+'">Tham gia Zalo</a>':'')+'</article>').join('');
  if(data.zalo&&/^https:\/\/zalo\.me\//i.test(data.zalo)){$('#zalo').href=data.zalo;$('#zalo').hidden=false;}
  save();
}
function cartContent(){
  const list=items();
  const g=data.groups.find(g=>g.id===selectedGroup);
  const kinds=Object.keys(days).filter(k=>list.some(p=>p.kind===k));
  const subtotal=list.reduce((n,p)=>n+price(p)*bag[p.id],0);
  const closed=list.some(p=>!canBuy(p));
  $('#cart-body').innerHTML=list.length?'<div>'+kinds.map(k=>'<h3>'+days[k]+'</h3>'+list.filter(p=>p.kind===k).map(p=>'<div class="cart-item"><div>'+esc(p.name)+'<span>'+money(price(p))+' / '+esc(p.unit)+'</span></div><div class="qty"><button aria-label="Bớt '+esc(p.name)+'" data-qty="'+p.id+'" data-step="-1">−</button>'+bag[p.id]+'<button aria-label="Thêm '+esc(p.name)+'" data-qty="'+p.id+'" data-step="1" '+(canBuy(p)?'':'disabled')+'>+</button></div></div>').join('')).join('')+'</div><p class="totals">Tiền hàng '+money(subtotal)+'</p><p class="notice">'+(g?.fee!=null?'Phí giao '+money(g.fee)+' mỗi đơn. Tổng dự kiến '+money(subtotal+kinds.length*g.fee)+'.':'Phí giao sẽ được xác nhận sau khi đặt.')+(kinds.length===2?' Giỏ có hai lịch giao nên sẽ tạo hai đơn.':'')+'</p>'+(closed?'<p class="error">Có món đã hết giờ nhận. Giảm số lượng về 0 để đặt các món còn mở.</p>':'')+'<form id="checkout" class="form"><div class="fields"><label>Họ tên<input name="name" required maxlength="90" autocomplete="name" value="'+esc(buyer.name)+'"></label><label>Số điện thoại<input name="phone" type="tel" required autocomplete="tel" value="'+esc(buyer.phone)+'"></label></div><label>Địa chỉ giao<input name="address" required maxlength="240" autocomplete="street-address" value="'+esc(buyer.address)+'"></label><label>Cụm giao hàng<select name="group" required><option value="">Chọn cụm phù hợp với địa chỉ</option>'+data.groups.map(g=>'<option value="'+esc(g.id)+'" '+(selectedGroup===g.id?'selected':'')+'>'+esc(g.name)+'</option>').join('')+'</select></label><label>Ghi chú<textarea name="note" rows="2" maxlength="240">'+esc(buyer.note)+'</textarea></label><button class="button olive" '+(closed?'disabled':'')+'>Gửi đơn hàng</button><span class="error" role="alert"></span></form>':'<p>Giỏ hàng đang trống.</p>';
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');
  if(!b) return;
  if(b.classList.contains('close')) b.closest('dialog').close();
  if(!data) return;
  if(b.id==='cart-button'){cartContent();cart.showModal();}
  if(b.dataset.detail){
    const p=data.products.find(p=>p.id===b.dataset.detail);
    $('#detail-title').textContent=p.name;
    $('#detail-body').innerHTML='<div class="gallery">'+p.images.map(x=>'<img src="'+esc(x)+'" alt="'+esc(p.name)+'">').join('')+'</div><p>'+esc(p.description)+'</p><p>'+esc(p.unit)+' · '+money(price(p))+'</p>';
    details.showModal();
  }
  if(b.dataset.add){increment(b.dataset.add,1);toast('Đã thêm vào giỏ');}
  if(b.dataset.qty){
    if($('#checkout')) buyer=pairs($('#checkout'));
    increment(b.dataset.qty,Number(b.dataset.step));cartContent();
    const buttons=[...cart.querySelectorAll('[data-qty]')];
    (buttons.find(x=>x.dataset.qty===b.dataset.qty&&x.dataset.step===b.dataset.step)||$('.close',cart)).focus();
  }
});
cart.addEventListener('change',e=>{
  if(e.target.name==='group'){buyer=pairs(e.target.form);selectedGroup=e.target.value;cartContent();$('[name=group]',cart).focus();}
});
cart.addEventListener('submit',async e=>{
  e.preventDefault();
  const f=e.target,b=$('button[type=submit], form button',f), message=$('.error',f);
  b.disabled=true;message.textContent='';
  buyer=pairs(f);
  try{
    const payload={...buyer,lines:items().map(p=>({id:p.id,qty:bag[p.id]}))};
    const fingerprint=JSON.stringify(payload);
    if(lastCheckout?.fingerprint!==fingerprint) lastCheckout={fingerprint,key:crypto.randomUUID()};
    const orders=await api('/api/orders',{...payload,requestKey:lastCheckout.key});
    rememberOrders(orders);
    bag={};buyer={};lastCheckout=null;save();
    $('#cart-body').innerHTML='<h3>Đã nhận đơn</h3><p>Lee’s Shop sẽ xác nhận lịch và phí giao. Hãy giữ link để xem trạng thái.</p>'+orders.map(o=>'<p><a class="button outline" href="/tra-don#'+encodeURIComponent(o.token)+'">Xem '+esc(days[o.kind])+' · '+esc(o.code)+'</a></p>').join('');
  }catch(err){message.textContent=err.message;b.disabled=false;}
});
try{data=await api('/api/catalog');render();}catch(e){$('#catalog-error').textContent='Chưa tải được danh mục. Vui lòng thử tải lại trang.';}
