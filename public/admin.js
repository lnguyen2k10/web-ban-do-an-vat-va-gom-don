import {$,api,esc,money,date,days,pairs} from './common.js';
const statuses=['Chờ xác nhận','Đã xác nhận','Đang soạn','Đã soạn','Đang giao','Đã giao','Giao chưa thành công','Đã hủy'];
const roles={admin:'Quản trị',staff:'Soạn hàng',courier:'Giao hàng'};
const sections={orders:'Đơn hàng',customers:'Khách hàng',products:'Sản phẩm',groups:'Cụm giao',suppliers:'Nhà cung cấp',purchases:'Gom hàng',report:'Báo cáo',users:'Tài khoản'};
const dialog=$('#editor'),view=$('#view'),status=$('#status');
let data,tab='orders',renderID=0,filters={},purchaseWeek='',reportFilters={};
const button=(text,action,value='',primary=false)=>'<button type="button" class="button '+(primary?'olive':'outline')+'" data-do="'+action+'" data-id="'+esc(value)+'">'+esc(text)+'</button>';
const opts=(items,selected)=>items.map(([v,label])=>'<option value="'+esc(v)+'" '+(v===selected?'selected':'')+'>'+esc(label)+'</option>').join('');
const field=(label,name,value='',type='text',more='')=>'<label>'+label+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+more+'></label>';
const select=(label,name,items,v,more='')=>'<label>'+label+'<select name="'+name+'" '+more+'>'+opts(items,v)+'</select></label>';
const checkbox=(label,name,on)=>'<label class="inline"><input type="checkbox" name="'+name+'" '+(on?'checked':'')+'> '+label+'</label>';
const table=(heads,rows)=>rows.length?'<div class="table-wrap"><table><thead><tr>'+heads.map(h=>'<th scope="col">'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':'<p class="muted">Chưa có dữ liệu.</p>';
const submit=(name='Lưu')=>'<button class="button olive">'+name+'</button>';
const links=items=>items.map(x=>[x.id,x.name]);
const cost=o=>o.lines.reduce((n,l)=>n+l.cost*l.qty,0);
const total=o=>o.lines.reduce((n,l)=>n+l.price*l.qty,0)+(o.fee??0);
const paid=o=>o.payments.reduce((n,p)=>n+p.amount,0);
const admin=()=>data.user.role==='admin';
const get=(type,id)=>data[type].find(x=>x.id===id);
const num='min="0" step="1"';
const dt=x=>new Date(x).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
const form=(contents,handler)=>'<form class="form" data-form="'+handler+'">'+contents+'<p class="error" role="alert"></p></form>';
const wrappers=(s)=>'<div class="panel">'+s+'</div>';
function message(s,error=true){status.textContent=s;status.className=error?'error':'notice';status.hidden=!s;}
function edit(title,contents){$('#editor-title').textContent=title;$('#editor-body').innerHTML=contents;if(!dialog.open)dialog.showModal();}
function orderList(){
  const checkText=(o)=>[o.code,o.name,o.phone,o.groupName].some(v=>String(v||'').toLowerCase().includes((filters.search||'').toLowerCase()));
  const orders=data.orders.filter(o=>checkText(o)&&(!filters.status||o.status===filters.status)&&(!filters.group||o.group===filters.group)&&(!filters.when||(filters.by==='delivery'?o.delivery:o.date)===filters.when)&&(!filters.customer||o.customer===filters.customer));
  return (admin()?button('Nhập đơn Zalo','manual','',true)+' ':'')+button('Làm mới','refresh')+
    '<form class="filters" data-form="filters">'+field('Tìm đơn','search',filters.search,'search','placeholder="Mã, tên, số điện thoại"')+
    select('Xem theo','by',[['date','Ngày đặt'],['delivery','Ngày giao']],filters.by||'date')+field('Ngày','when',filters.when,'date')+
    select('Trạng thái','status',[['','Tất cả'],...statuses.map(s=>[s,s])],filters.status||'')+
    (admin()?select('Cụm giao','group',[['','Tất cả'],...links(data.groups)],filters.group||''):'')+submit('Lọc')+
    (filters.customer?button('Bỏ lọc khách','clear-customer'):'')+'</form>'+
    table(['Mã đơn','Khách','Cụm','Ngày đặt','Ngày giao','Trạng thái',admin()?'Còn phải thu':'Thao tác',...(admin()?['Thao tác']:[])],orders.map(o=>[
      esc(o.code)+'<br><span class="muted">'+days[o.kind]+'</span>',esc(o.name),esc(o.groupName),date(o.date),date(o.delivery),
      '<span class="pill">'+esc(o.status)+'</span>',...(admin()?[money(total(o)-paid(o))+(o.fee===null?'<br><span class="muted">Chưa chốt phí</span>':'')]:[]),button('Mở đơn','order',o.id)
    ]));
}
function orderEditor(o){
  const role=data.user.role;
  const paths={admin:[[1,7],[2,7],[3,7],[4,7],[5,6],[],[4,7],[]],staff:[[],[2],[3],[],[],[],[],[]],courier:[[],[],[],[],[5,6],[],[],[]]};
  const transitions=paths[role][statuses.indexOf(o.status)]||[];
  const next=transitions.map(i=>[statuses[i],statuses[i]]);
  let content='<div class="order-summary"><p>'+esc(o.name)+' · '+esc(o.groupName)+'</p><p>'+esc(o.status)+' · '+date(o.delivery)+'</p>';
  if(o.phone)content+='<p><a href="tel:'+esc(o.phone)+'">'+esc(o.phone)+'</a> · '+esc(o.address)+'</p>';
  if(o.lines)content+='<ul class="plain-list">'+o.lines.map(l=>'<li>'+esc(l.name)+' · '+l.qty+' × '+esc(l.unit)+(admin()?' · '+money(l.price):'')+'</li>').join('')+'</ul>';
  if(o.due!=null)content+='<p>Cần thu '+money(o.due)+'</p>';
  content+='</div>';
  if(admin()){
    const sunday=o.week?new Date(Date.parse(o.week)+86400000).toISOString().slice(0,10):null;
    const dates=o.kind==='weekly'?[['','Chưa xếp lịch'],[o.week,'Thứ Bảy · '+date(o.week)],[sunday,'Chủ nhật · '+date(sunday)]]:[[o.date,date(o.date)]];
    content+='<p>Tiền đơn '+money(total(o))+' · Đã thu '+money(paid(o))+' · Còn '+money(total(o)-paid(o))+'</p><p>Giá vốn '+money(cost(o))+' · Lãi trước chi phí chung '+money(total(o)-cost(o)-o.expense)+'</p>'+(o.note?'<p>Ghi chú khách: '+esc(o.note)+'</p>':'');
    content+=form('<input type="hidden" name="id" value="'+o.id+'"><div class="fields">'+select('Ngày giao','delivery',dates,o.delivery||'')+select('Người giao','courier',[['','Chưa phân công'],...links(data.users.filter(u=>u.role==='courier'))],o.courier)+
      field('Phí giao','fee',o.fee,'number',num)+field('Chi phí shop chịu','expense',o.expense,'number',num+' required')+
      (o.kind==='weekly'?field('Mức cọc yêu cầu','deposit',o.deposit,'number',num+' required'):'')+field('Ghi nhận tiền thực thu','payment','','number',num)+'</div>'+submit('Lưu thông tin'),'order-settings');
    content+='<details><summary>Nhật ký đơn hàng</summary><ul class="plain-list">'+o.events.map(e=>'<li>'+esc(dt(e.at))+' · '+esc(e.actor)+' · '+esc(e.message)+'</li>').join('')+'</ul></details>';
  }
  if(next.length) content+=form('<input type="hidden" name="id" value="'+o.id+'">'+select('Chuyển trạng thái','status',[['','Chọn trạng thái'],...next],'','required')+submit('Cập nhật trạng thái'),'order-status');
  edit(o.code,content);
}
function manual(){
  const products=data.products.filter(p=>p.active);
  edit('Nhập đơn Zalo',form('<div class="fields">'+field('Họ tên','name','','text','required')+field('Số điện thoại','phone','','tel','required')+'</div>'+field('Địa chỉ','address','','text','required')+
    select('Cụm giao','group',[['','Chọn cụm'],...links(data.groups.filter(g=>g.active))],'','required')+field('Ghi chú','note')+
    '<div class="stack">'+products.map(p=>field(esc(p.name)+' · '+esc(p.unit)+' · '+days[p.kind],'q_'+p.id,'','number',num+' max="99"')).join('')+'</div>'+submit('Tạo đơn'),'manual'));
}
function products(){
  return '<div class="actions">'+button('Thêm sản phẩm','product','',true)+button('Nhập Excel','import')+'<a class="button outline" href="/api/manage/template">Tải Excel mẫu</a></div>'+
    table(['Ảnh','Món','Nhóm','Giá thường / ưu đãi','Nhà cung cấp','Thao tác'],data.products.map(p=>['<img class="photo-preview" alt="" src="'+esc(p.images[0])+'">',esc(p.name)+'<br>'+esc(p.sku)+(p.active?'':' · Ẩn'),days[p.kind],money(p.price)+(p.promo==null?'':' / '+money(p.promo)),esc(get('suppliers',p.supplier)?.name),button('Sửa','product',p.id)+' '+button('Nhân bản','copy',p.id)]));
}
function productEditor(p,copy){
  const value=p||{};
  edit(copy?'Nhân bản sản phẩm':p?'Sửa sản phẩm':'Thêm sản phẩm',form('<input type="hidden" name="id" value="'+(copy?'':esc(value.id))+'"><div class="fields">'+
    field('Tên món','name',value.name,'text','required')+field('Mã SKU','sku',copy?'':value.sku,'text','required')+field('Quy cách','unit',value.unit,'text','required')+
    select('Nhóm món','kind',Object.entries(days),value.kind||'daily')+field('Giá bán','price',value.price,'number',num+' required')+field('Giá ưu đãi','promo',value.promo,'number',num)+field('Giá vốn','cost',value.cost,'number',num+' required')+
    select('Nhà cung cấp','supplier',links(data.suppliers),value.supplier||'mau')+'</div><label>Mô tả<textarea name="description" maxlength="1200">'+esc(value.description)+'</textarea></label>'+
    [0,1,2].map(i=>'<div class="fields">'+field('Ảnh '+(i+1)+' · URL HTTPS','image'+i,value.images?.[i]?.startsWith('data:')?'':value.images?.[i],'text')+
      '<label>Hoặc chọn ảnh '+(i+1)+'<input name="file'+i+'" type="file" accept="image/jpeg,image/png,image/webp"></label>'+
      (value.images?.[i]?.startsWith('data:')?checkbox('Giữ ảnh đã tải lên','keep'+i,true):'')+'</div>').join('')+
    checkbox('Hiện trong cửa hàng','active',value.active!==false)+submit(),'product'));
  dialog.currentProduct=value;
}
function groupEditor(g={}){
  edit(g.id?'Sửa cụm giao':'Thêm cụm giao',form(field('Mã cụm','id',g.id,'text','required pattern="[a-z0-9]+(-[a-z0-9]+)*" '+(g.id?'readonly':''))+
    field('Tên hiển thị','name',g.name,'text','required')+field('Phạm vi','area',g.area)+field('Điểm tập kết','hub',g.hub)+field('Link nhóm Zalo','zalo',g.zalo,'url')+
    field('Phí giao · bỏ trống nếu báo sau','fee',g.fee,'number',num)+checkbox('Mở nhận đơn theo cụm','active',g.active!==false)+submit(),'group'));
}
function supplierEditor(s={}){
  edit(s.id?'Sửa nhà cung cấp':'Thêm nhà cung cấp',form('<input type="hidden" name="id" value="'+esc(s.id)+'">'+field('Tên nhà cung cấp','name',s.name,'text','required')+
    field('Số liên hệ','phone',s.phone,'tel')+field('Địa chỉ','address',s.address)+submit(),'supplier'));
}
function importEditor(){
  edit('Nhập sản phẩm từ Excel',form('<p>Dùng giá trị <code>daily</code> hoặc <code>weekly</code> cho nhóm món. Cột <code>supplier</code> dùng mã nhà cung cấp trong trang quản trị.</p><label>Tệp .xlsx<input type="file" name="file" accept=".xlsx" required></label>'+submit('Xem trước'),'import')+'<div id="import-results"></div>');
}
function purchaseForm(){
  const chosen=purchaseWeek||data.schedule.saturday;
  return '<form class="filters" data-form="preview">'+field('Ngày thứ Bảy của đợt','week',chosen,'date','required')+submit('Xem số lượng cần đặt')+'</form><div id="preview"></div>'+
  '<h2>Phiếu đã lập</h2>'+table(['Đợt giao','Nhà cung cấp','Điểm nhận','Giá trị / Đã trả','Nhận hàng','Thao tác'],data.purchases.slice().reverse().map(p=>{
    const ordered=p.rows.reduce((n,r)=>n+r.qty,0),received=p.rows.reduce((n,r)=>n+r.received,0),value=p.rows.reduce((n,r)=>n+r.qty*r.cost,0);
    return [date(p.week),esc(p.supplier),[...new Set(p.rows.map(r=>r.destination))].map(x=>esc(x)).join('<br>'),money(value)+' / '+money(p.paid)+'<br>Còn '+money(value-p.paid),received+' / '+ordered,button('Mở phiếu','purchase-view',p.id)];
  }));
}
async function preview(){
  const wrapper=$('#preview'),week=purchaseWeek;
  const rows=await api('/api/manage/purchases/preview?week='+encodeURIComponent(week));
  if(!wrapper?.isConnected||week!==purchaseWeek) return;
  wrapper.innerHTML=rows.length?wrappers(table(['Nhà cung cấp','Cụm','Món','SL','Đơn khách'],rows.map(r=>[esc(get('suppliers',r.supplier)?.name),esc(get('groups',r.group)?.name),esc(r.name),r.qty,r.refs.map(x=>esc(x.code)+' × '+x.qty).join('<br>')]))+
    form('<div class="fields">'+select('Nhà cung cấp','supplier',links(data.suppliers.filter(s=>rows.some(r=>r.supplier===s.id))))+
    select('Phạm vi phiếu','group',[['all','Tất cả cụm có hàng'],...links(data.groups.filter(g=>rows.some(r=>r.group===g.id)))])+'</div>'+
    field('Điểm nhận chung · bỏ trống để dùng điểm từng cụm','hub')+submit('Lập phiếu'),'purchase')):'<p>Đợt này chưa có món cần lập phiếu.</p>';
}
function purchaseEditor(p){
  const text=[p.supplier,'Đợt '+date(p.week),...p.rows.map(r=>r.destination+' | '+r.groupName+' | '+r.name+' × '+r.qty+' '+r.unit)].join('\n');
  edit('Phiếu đặt nhà cung cấp', '<p>'+esc(p.supplier)+' · Đợt '+date(p.week)+'</p>'+
    table(['Cụm / Điểm nhận','Món','Đã đặt','Đã nhận','Đơn khách'],p.rows.map(r=>[esc(r.groupName)+'<br>'+esc(r.destination),esc(r.name),r.qty,r.received,r.refs.map(x=>esc(x.code)+' × '+x.qty).join('<br>')]))+
    '<details><summary>Nội dung gửi nhà cung cấp</summary><pre>'+esc(text)+'</pre></details>'+
    form('<input type="hidden" name="id" value="'+p.id+'"><div class="fields">'+
      p.rows.map((r,i)=>field('Đã nhận · '+esc(r.name)+' / '+esc(r.groupName),'r'+i,r.received,'number',num+' max="'+r.qty+'" required')).join('')+
      field('Tổng đã thanh toán','paid',p.paid,'number',num+' required')+'</div>'+submit(),'purchase-update'));
}
function reports(){
  return '<form class="filters" data-form="report">'+field('Từ ngày','from',reportFilters.from,'date')+field('Đến ngày','to',reportFilters.to,'date')+
    select('Nhóm theo','by',[['day','Ngày'],['month','Tháng'],['customer','Khách hàng'],['order','Đơn hàng']],reportFilters.by||'day')+
    select('Khách','customer',[['','Tất cả'],...data.customers.map(c=>[c.id,c.name+' · '+c.phone])],reportFilters.customer||'')+submit('Xem báo cáo')+'</form><div id="report-data"></div>'+
    '<h2>Chi phí chung</h2>'+button('Thêm chi phí','expense')+table(['Ngày','Khoản chi','Số tiền'],data.expenses.slice().reverse().map(x=>[date(x.date),esc(x.name),money(x.amount)]));
}
async function loadReport(){
  const slot=$('#report-data');
  const r=await api('/api/manage/report?'+new URLSearchParams(reportFilters));
  if(!slot?.isConnected)return;
  slot.innerHTML=table(['Nhóm','Doanh thu','Đã thu','Giá vốn','Chi phí','Lợi nhuận'],r.map(v=>[esc(v.key),...['revenue','received','cost','expenses','profit'].map(k=>money(v[k]))]));
}
function page(){
  const current=++renderID;
  const views={
    orders:orderList,products, purchases:purchaseForm,report:reports,
    customers:()=>table(['Khách','Số điện thoại','Địa chỉ mới nhất','Đơn đặt','Thao tác'],data.customers.map(c=>[esc(c.name),esc(c.phone),esc(c.address),data.orders.filter(o=>o.customer===c.id).length,button('Lịch sử','customer',c.id)])),
    groups:()=>button('Thêm cụm','group','',true)+table(['Tên / Mã','Phạm vi','Điểm tập kết','Phí giao','Thao tác'],data.groups.map(g=>[esc(g.name)+'<br>'+esc(g.id)+(g.active?'':' · Tạm đóng'),esc(g.area),esc(g.hub)||'Chưa cấu hình',g.fee==null?'Báo sau':money(g.fee),button('Sửa','group',g.id)+' '+button('QR & link','qr',g.id)])),
    suppliers:()=>button('Thêm nhà cung cấp','supplier','',true)+table(['Tên','Mã nhập Excel','Liên hệ','Địa chỉ','Thao tác'],data.suppliers.map(s=>[esc(s.name),'<code>'+esc(s.id)+'</code>',esc(s.phone),esc(s.address),button('Sửa','supplier',s.id)])),
    users:()=>button('Thêm tài khoản','user','',true)+table(['Tên','Tên đăng nhập','Vai trò'],data.users.map(u=>[esc(u.name),esc(u.login),roles[u.role]]))
  };
  $('#tabs').innerHTML=(admin()?Object.keys(sections):['orders']).map(t=>button(sections[t],'tab',t,t===tab)).join('');
  view.innerHTML=views[tab]();
  if(tab==='report')loadReport().catch(e=>{if(current===renderID)message(e.message);});
  if(tab==='purchases'&&purchaseWeek)preview().catch(e=>{if(current===renderID)message(e.message);});
}
async function refresh(){
  try{
    data=await api('/api/manage');
    $('#login').hidden=true;$('#workspace').hidden=false;$('#logout').hidden=false;
    $('#account').textContent=data.user.name+' · '+roles[data.user.role];
    if(!admin())tab='orders';
    page();
  }catch(e){
    $('#login').hidden=false;$('#workspace').hidden=true;$('#logout').hidden=true;
    if(e.status!==401)message(e.message);
  }
}
$('#close').onclick=()=>dialog.close();
$('#logout').onclick=async()=>{try{await api('/api/logout',{});tab='orders';filters={};await refresh();}catch(e){message(e.message);}};
$('#login').addEventListener('submit',async e=>{
  e.preventDefault();message('');const b=e.submitter;b.disabled=true;
  try{await api('/api/login',pairs(e.target));e.target.reset();await refresh();}
  catch(e){message(e.message);}finally{b.disabled=false;}
});
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-do]');
  if(!b)return;
  const {do:action,id}=b.dataset;
  message('');
  if(action==='tab'){tab=id;page();}
  if(action==='refresh')await refresh();
  if(action==='order')orderEditor(get('orders',id));
  if(action==='manual')manual();
  if(action==='customer'){filters={customer:id};tab='orders';page();}
  if(action==='clear-customer'){delete filters.customer;page();}
  if(action==='product'||action==='copy')productEditor(id?get('products',id):null,action==='copy');
  if(action==='import')importEditor();
  if(action==='group')groupEditor(id?get('groups',id):undefined);
  if(action==='supplier')supplierEditor(id?get('suppliers',id):undefined);
  if(action==='purchase-view')purchaseEditor(get('purchases',id));
  if(action==='qr'){
    const link=new URL('/dat-hang?cum='+encodeURIComponent(id),location.origin);
    const qr='/api/manage/qr?group='+encodeURIComponent(id);
    edit('Mã QR đặt hàng', '<p><a href="'+esc(link.href)+'">'+esc(link.href)+'</a></p><img class="qr" src="'+qr+'" alt="QR đặt hàng theo cụm"><a class="button outline" download="lees-shop-'+esc(id)+'.svg" href="'+qr+'">Tải mã QR</a><p class="muted">Tạo lại QR từ tên miền chính thức trước khi in tờ rơi.</p>');
  }
  if(action==='user')edit('Thêm tài khoản',form(field('Tên','name','','text','required')+field('Tên đăng nhập','login','','text','required')+field('Mật khẩu','password','','password','required minlength="12"')+select('Vai trò','role',Object.entries(roles),'staff')+submit(),'user'));
  if(action==='expense')edit('Thêm chi phí chung',form(field('Khoản chi','name','','text','required')+field('Ngày','date',data.schedule.date,'date','required')+field('Số tiền','amount','','number',num+' required')+submit(),'expense'));
});
const fileURL=file=>new Promise((resolve,reject)=>{
  if(file.size>650000)return reject(new Error('Mỗi ảnh tối đa 650 KB.'));
  const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Không đọc được ảnh.'));reader.readAsDataURL(file);
});
document.addEventListener('submit',async e=>{
  const f=e.target,action=f.dataset.form;
  if(!action)return;
  e.preventDefault();message('');
  const b=e.submitter,error=$('.error',f),v=pairs(f);
  b.disabled=true;if(error)error.textContent='';
  try{
    if(action==='filters'){filters={...v,customer:filters.customer};page();return;}
    if(action==='report'){reportFilters=v;await loadReport();return;}
    if(action==='preview'){purchaseWeek=v.week;await preview();return;}
    if(action==='manual'){v.lines=Object.entries(v).filter(([k,n])=>k.startsWith('q_')&&Number(n)>0).map(([k,n])=>({id:k.slice(2),qty:Number(n)}));await api('/api/manage/order',v);}
    else if(action==='order-settings'||action==='order-status'){
      const {id,...payload}=v;
      await api('/api/manage/order/'+id,payload,'PATCH');
      await refresh();const order=get('orders',id);if(order) orderEditor(order);else dialog.close();message('Đã lưu.',false);return;
    }else if(action==='product'){
      v.images=(await Promise.all([0,1,2].map(i=>v['file'+i].size?fileURL(v['file'+i]):v['keep'+i]?dialog.currentProduct.images[i]:v['image'+i]))).filter(Boolean);
      v.active=Boolean(v.active);
      for(let i=0;i<3;i++){delete v['file'+i];delete v['keep'+i];delete v['image'+i];}
      await api('/api/manage/product',v);
    }else if(action==='group'){v.active=Boolean(v.active);await api('/api/manage/group',v);}
    else if(action==='purchase'){await api('/api/manage/purchase',{...v,week:purchaseWeek});}
    else if(action==='purchase-update'){
      const p=get('purchases',v.id);
      await api('/api/manage/purchase/update',{id:v.id,paid:v.paid,received:p.rows.map((_,i)=>v['r'+i])});
    }else if(action==='import'){
      const result=await api('/api/manage/import',v.file);
      dialog.importFile=v.file;
      $('#import-results').innerHTML='<p>'+result.result.length+' dòng hợp lệ · '+result.errors.length+' dòng cần sửa.</p>'+table(['SKU','Tên món'],result.result.map(p=>[esc(p.sku),esc(p.name)]))+
        (result.errors.length?table(['Dòng','Lỗi'],result.errors.map(x=>[x.row,esc(x.message)])):form(submit('Xác nhận nhập'),'apply-import'));
      return;
    }else if(action==='apply-import'){await api('/api/manage/import?apply=1',dialog.importFile);}
    else await api('/api/manage/'+action,v);
    if(dialog.open)dialog.close();
    await refresh();message('Đã lưu.',false);
  }catch(e){if(error)error.textContent=e.message;else message(e.message);}
  finally{b.disabled=false;}
});
await refresh();
