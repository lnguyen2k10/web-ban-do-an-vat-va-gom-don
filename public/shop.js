import {$,esc,money,date,api,pairs,days,rememberOrders} from './common.js';
const cart=$('#cart'),details=$('#details'), addToast=$('#toast');
const groupLink=new URL(location.href).searchParams.get('cum')||'';
let data,selectedGroup=groupLink, buyer={}, bag;
try{bag=JSON.parse(localStorage.getItem('lees-cart'))||{};}catch{bag={};}
const items=()=>data.products.filter(p=>bag[p.id]>0);
const canBuy=p=>data.schedule[p.kind];
const price=p=>p.promo??p.price;
let timer, lastCheckout, showCheckout=false, detailProduct, descriptionPages=[], imageIndex=0, descriptionIndex=0;
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
  $('#daily-delivery').textContent=data.schedule.daily?'Giao hôm nay · '+date(data.schedule.date):'Đã hết giờ nhận đơn giao hôm nay.';
  $('#weekly-delivery').textContent='Thứ Bảy '+date(data.schedule.saturday)+' hoặc Chủ nhật '+date(data.schedule.sunday)+'.';
  $('#group-grid').innerHTML=data.groups.map(g=>'<article class="card group-card"><h3>'+esc(g.name)+'</h3><p>'+esc(g.area)+'</p><a class="button outline" href="/dat-hang?cum='+encodeURIComponent(g.id)+'#daily">Đặt theo cụm</a>'+(g.zalo?'<a class="button olive" target="_blank" rel="noopener" href="'+esc(g.zalo)+'">Tham gia Zalo</a>':'')+'</article>').join('');
  if(data.zalo&&/^https:\/\/zalo\.me\//i.test(data.zalo)){$('#zalo').href=data.zalo;$('#zalo').hidden=false;}
  save();
}
function deliveryText(kind) {
  if(kind==='daily') return 'Giao trong ngày · '+date(data.schedule.date);
  return 'Thứ Bảy '+date(data.schedule.saturday)+' hoặc Chủ nhật '+date(data.schedule.sunday);
}
function cartRow(p){
  const name=esc(p.name), qty=bag[p.id];
  return `<div class="cart-item">
    <div><strong>${name}</strong><span>${money(price(p))} / ${esc(p.unit)} · <b data-line-total>${money(price(p)*qty)}</b></span></div>
    <div class="cart-controls"><div class="qty">
      <button type="button" aria-label="Bớt ${name}" data-qty="${p.id}" data-step="-1" ${qty===1?'disabled':''}>−</button>
      <input aria-label="Số lượng ${name}" data-quantity="${p.id}" type="number" min="1" max="${canBuy(p)?99:qty}" value="${qty}">
      <button type="button" aria-label="Thêm ${name}" data-qty="${p.id}" data-step="1" ${canBuy(p)&&qty<99?'':'disabled'}>+</button>
    </div><button type="button" class="remove" aria-label="Xóa ${name}" data-remove="${p.id}">Xóa</button></div>
  </div>`;
}
function cartContent(){
  const list=items(), target=$('#cart-body');
  $('#cart-title').textContent=showCheckout?'Thông tin người đặt':'Giỏ hàng';
  if(!list.length){target.innerHTML='<p>Giỏ hàng đang trống.</p>';return;}
  const group=data.groups.find(g=>g.id===selectedGroup);
  const kinds=Object.keys(days).filter(k=>list.some(p=>p.kind===k));
  const subtotal=list.reduce((n,p)=>n+price(p)*bag[p.id],0);
  const closed=list.some(p=>!canBuy(p));
  const fee=group?.fee!=null?'Phí giao '+money(group.fee)+' mỗi đơn. Tổng dự kiến '+money(subtotal+kinds.length*group.fee)+'.':'Phí giao sẽ được xác nhận sau khi đặt.';
  const summary=`<p class="totals">Tiền hàng ${money(subtotal)}</p><p class="notice" data-cart-fee>${fee}${kinds.length===2?' Giỏ có hai lịch giao nên sẽ tạo hai đơn.':''}</p>`;
  if(!showCheckout){
    target.innerHTML=kinds.map(k=>`<section class="cart-section"><h3>${days[k]}</h3><p class="muted">${deliveryText(k)}</p>${list.filter(p=>p.kind===k).map(cartRow).join('')}</section>`).join('')+summary+
      (closed?'<p class="error">Xóa món đã hết giờ nhận để tiếp tục.</p>':'')+
      `<button type="button" id="start-checkout" class="button olive" ${closed?'disabled':''}>Tiếp tục đặt hàng</button>`;
    return;
  }
  target.innerHTML=`<form id="checkout" class="form">
    <div class="fields">
      <label>Họ tên người đặt<input name="name" required maxlength="90" autocomplete="name" value="${esc(buyer.name)}"></label>
      <label>Số điện thoại người đặt<input name="phone" type="tel" required autocomplete="tel" value="${esc(buyer.phone)}"></label>
    </div>
    <label>Địa chỉ giao<input name="address" required maxlength="240" autocomplete="street-address" value="${esc(buyer.address)}"></label>
    <label>Cụm giao hàng<select name="group" required><option value="">Chọn cụm phù hợp với địa chỉ</option>${data.groups.map(g=>`<option value="${esc(g.id)}" ${selectedGroup===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select></label>
    <label>Ghi chú<textarea name="note" rows="2" maxlength="240">${esc(buyer.note)}</textarea></label>
    <div>${kinds.map(k=>`<div class="muted">${days[k]} · ${deliveryText(k)}</div>`).join('')}${summary}</div>
    <div class="actions"><button type="button" id="edit-cart" class="button outline">Sửa giỏ hàng</button><button id="submit-order" class="button olive" ${closed?'disabled':''}>Gửi đơn hàng</button></div>
    <span class="error" role="alert"></span>
  </form>`;
}
function renderDetail(){
  const p=detailProduct;
  const imageOptions=p.images.length>1?`<div class="detail-images" aria-label="Ảnh sản phẩm">${p.images.map((x,i)=>`<button type="button" class="outline" aria-label="Xem ảnh ${i+1}" aria-pressed="${i===imageIndex}" data-image="${i}"><img src="${esc(x)}" alt=""></button>`).join('')}</div>`:'';
  const paging=descriptionPages.length>1?`<div class="detail-paging"><button type="button" class="outline" data-desc="-1" ${descriptionIndex===0?'disabled':''}>Trước</button><span>Mô tả ${descriptionIndex+1}/${descriptionPages.length}</span><button type="button" class="outline" data-desc="1" ${descriptionIndex===descriptionPages.length-1?'disabled':''}>Tiếp</button></div>`:'';
  $('#detail-body').innerHTML=`<div class="detail-media"><img class="detail-photo" src="${esc(p.images[imageIndex])}" alt="${esc(p.name)}">${imageOptions}</div>
    <div class="detail-info"><p class="muted">${esc(p.unit)} · ${deliveryText(p.kind)}</p><p class="detail-description">${esc(descriptionPages[descriptionIndex])}</p>${paging}
    <div class="price-line"><strong class="price">${money(price(p))} ${p.promo==null?'':'<del>'+money(p.price)+'</del>'}</strong><button class="button olive" data-add="${p.id}" ${canBuy(p)?'':'disabled'}>${canBuy(p)?'Thêm vào giỏ':'Đã chốt'}</button></div></div>`;
}
function openCart(step=false){
  showCheckout=step;
  cartContent();
  if(!cart.open) cart.showModal();
  cart.scrollTop=0;
  $(step?'[name=name]':'.close',cart)?.focus();
}
function updateQuantity(id, value, redraw=true) {
  const p=items().find(item=>item.id===id);
  if(!p) return;
  const max=canBuy(p)?99:bag[id];
  bag[id]=Math.min(max,Math.max(1,Math.trunc(Number(value))||1));
  save();
  if(redraw) cartContent();
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');
  if(!b) return;
  if(b.classList.contains('close')) b.closest('dialog').close();
  if(!data) return;
  if(b.id==='cart-button') openCart();
  if(b.id==='start-checkout') openCart(true);
  if(b.id==='edit-cart'){
    buyer=pairs($('#checkout'));
    openCart();
  }
  if(b.dataset.detail){
    detailProduct=data.products.find(p=>p.id===b.dataset.detail);
    descriptionPages=detailProduct.description.match(/.{1,135}(?:\s|$)|.{1,135}/gs)?.map(s=>s.trim())||[''];
    imageIndex=descriptionIndex=0;
    $('#detail-title').textContent=detailProduct.name;
    renderDetail();
    details.showModal();
  }
  if(b.dataset.image!==undefined){
    imageIndex=Number(b.dataset.image);
    renderDetail();
    $(`[data-image="${imageIndex}"]`,details)?.focus();
  }
  if(b.dataset.desc){
    descriptionIndex+=Number(b.dataset.desc);
    renderDetail();
    ($(`[data-desc="${b.dataset.desc}"]:enabled`,details) || $('.detail-paging button:enabled',details))?.focus();
  }
  if(b.dataset.add){
    increment(b.dataset.add,1);
    if(details.open) details.close();
    toast('Đã thêm vào giỏ');
  }
  if(b.dataset.qty){
    updateQuantity(b.dataset.qty,bag[b.dataset.qty]+Number(b.dataset.step));
    ($(`[data-qty="${b.dataset.qty}"][data-step="${b.dataset.step}"]:enabled`,cart)||$(`[data-quantity="${b.dataset.qty}"]`,cart))?.focus();
  }
  if(b.dataset.remove){
    delete bag[b.dataset.remove];
    save();
    cartContent();
    ($('[data-remove]',cart)||$('.close',cart)).focus();
  }
});
cart.addEventListener('change',e=>{
  if(e.target.dataset.quantity){
    const id=e.target.dataset.quantity;
    updateQuantity(id,e.target.value,false);
    e.target.value=bag[id];
    const row=e.target.closest('.cart-item'), p=data.products.find(p=>p.id===id);
    $('[data-line-total]',row).textContent=money(price(p)*bag[id]);
    $('[data-step="-1"]',row).disabled=bag[id]===1;
    $('[data-step="1"]',row).disabled=!canBuy(p)||bag[id]>=99;
    const list=items(), subtotal=list.reduce((n,item)=>n+price(item)*bag[item.id],0);
    $('.totals',cart).textContent='Tiền hàng '+money(subtotal);
    const fee=data.groups.find(g=>g.id===selectedGroup)?.fee;
    if(fee!=null){
      const count=new Set(list.map(item=>item.kind)).size;
      $('[data-cart-fee]',cart).textContent='Phí giao '+money(fee)+' mỗi đơn. Tổng dự kiến '+money(subtotal+count*fee)+'.'+(count===2?' Giỏ có hai lịch giao nên sẽ tạo hai đơn.':'');
    }
  }
  if(e.target.name==='group'){
    buyer=pairs(e.target.form);
    selectedGroup=e.target.value;
    cartContent();
    $('[name=group]',cart).focus();
  }
});
cart.addEventListener('close',()=>{
  const form=$('#checkout');
  if(form) buyer=pairs(form);
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
    const contact='<p><strong>Người đặt:</strong> '+esc(buyer.name)+' · '+esc(buyer.phone)+'</p>';
    rememberOrders(orders);
    bag={};buyer={};lastCheckout=null;save();
    $('#cart-title').textContent='Đã nhận đơn';
    $('#cart-body').innerHTML=contact+'<p>Lee’s Shop sẽ xác nhận lịch và phí giao. Hãy giữ link để xem trạng thái.</p>'+orders.map(o=>'<p><a class="button outline" href="/tra-don#'+encodeURIComponent(o.token)+'">Xem '+esc(days[o.kind])+' · '+esc(o.code)+'</a></p>').join('');
  }catch(err){message.textContent=err.message;b.disabled=false;}
});
try{data=await api('/api/catalog');render();}catch(e){$('#catalog-error').textContent='Chưa tải được danh mục. Vui lòng thử tải lại trang.';}
