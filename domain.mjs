import { randomUUID, randomBytes } from 'node:crypto';

export const states = ['Chờ xác nhận','Đã xác nhận','Đang soạn','Đã soạn','Đang giao','Đã giao','Giao chưa thành công','Đã hủy'];
export const id = randomUUID;
export const clean = (v, max = 240) => typeof v === 'string' ? v.trim().slice(0,max) : '';
export function check(condition, message, status = 400) {
  if (!condition) throw Object.assign(new Error(message), {status});
}
export function amount(v, max = 1e9) {
  check(v !== '' && v != null && Number.isSafeInteger(Number(v)) && Number(v) >= 0 && Number(v) <= max, 'Số tiền hoặc số lượng không hợp lệ.');
  return Number(v);
}
export function phone(v) {
  const n = clean(v,30).replace(/[ .()-]/g,'').replace(/^\+84/,'0');
  check(/^0\d{9}$/.test(n),'Nhập số điện thoại Việt Nam gồm 10 chữ số.');
  return n;
}
const dateFormat = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
export function calendar(now = new Date()) {
  const p = Object.fromEntries(dateFormat.formatToParts(now).map(x=>[x.type,x.value]));
  const date = p.year+'-'+p.month+'-'+p.day;
  const day = new Date(date+'T12:00:00Z').getUTCDay();
  const next = new Date(date+'T12:00:00Z');
  next.setUTCDate(next.getUTCDate()+(6-day+7)%7+((day===4 && +p.hour>=17)||day===5||day===6?7:0));
  const saturday = next.toISOString().slice(0,10);
  next.setUTCDate(next.getUTCDate()+1);
  return {date, daily:+p.hour<17, weekly:day>=1&&day<=4&&(day!==4||+p.hour<17), saturday, sunday:next.toISOString().slice(0,10)};
}
export function seed() {
  const products = [
    ['BTB','Bánh tráng bơ','1 phần',25000,13000,'daily','Bánh tráng dẻo trộn bơ béo, hành phi và gia vị.','banh-trang'],
    ['CCB','Cơm cháy chà bông','100 g',35000,20000,'daily','Cơm cháy giòn rụm, phủ chà bông mặn ngọt.','com-chay'],
    ['LXT','Lạp xưởng tươi','500 g',145000,105000,'weekly','Lạp xưởng vị đậm đà, dùng áp chảo hoặc ăn cùng cơm.','lap-xuong'],
    ['CLU','Chả lụa','500 g',110000,80000,'weekly','Chả lụa cắt lát, tiện dùng cho bữa sáng và mâm cơm.','cha-lua'],
    ['DMC','Dưa cải muối chua','350 g',45000,28000,'weekly','Dưa cải giòn chua nhẹ, hợp ăn cùng các món đậm vị.','dua-cai']
  ].map(([sku,name,unit,price,cost,kind,description,image])=>({id:id(),sku,name,unit,price,cost,kind,description,images:['/img/'+image+'.jpg'],promo:null,supplier:'mau',active:true}));
  return {products, users:[], customers:[], orders:[], purchases:[], expenses:[], suppliers:[{id:'mau',name:'Nhà cung cấp mẫu',phone:'',address:''}], groups:[
    {id:'nguyen-gia-tri',name:'Nguyễn Gia Trí · Bình Thạnh',area:'Khu D2 – Nguyễn Gia Trí',hub:'',zalo:'',fee:null,active:true},
    {id:'quan-1-3',name:'Quận 1 – Quận 3',area:'Quận 1 và Quận 3',hub:'',zalo:'',fee:null,active:true}
  ]};
}
export function total(o) {
  return o.lines.reduce((sum,l)=>sum+l.price*l.qty,0)+(o.fee??0);
}
export const paid = o => o.payments.reduce((sum,p)=>sum+p.amount,0);
export function event(o, message, actor, now=new Date()) {
  o.events.push({at:now.toISOString(),message,actor});
}
export function place(db, input, actor, now = new Date()) {
  const name = clean(input.name,90), address = clean(input.address), number = phone(input.phone);
  const group = db.groups.find(g=>g.id===input.group&&g.active);
  check(name && address && group,'Điền tên, địa chỉ và cụm giao hàng.');
  check(Array.isArray(input.lines)&&input.lines.length>0&&input.lines.length<=100,'Giỏ hàng không hợp lệ.');
  check(new Set(input.lines.map(l=>l.id)).size===input.lines.length,'Giỏ hàng có món trùng.');
  const schedule=calendar(now);
  const lines=input.lines.map(l=>{
    const p=db.products.find(p=>p.id===l.id&&p.active);
    const qty=amount(l.qty,99);
    check(p&&qty>0,'Có món đã ngừng bán hoặc số lượng không hợp lệ.');
    if(actor==='web') check(schedule[p.kind],p.kind==='daily'?'Đồ ăn vặt chỉ nhận trước 17h mỗi ngày.':'Đơn gom nhận từ thứ Hai đến trước 17h thứ Năm.');
    return {id:p.id,name:p.name,unit:p.unit,kind:p.kind,price:p.promo??p.price,cost:p.cost,supplier:p.supplier,qty};
  });
  let customer=db.customers.find(c=>c.phone===number);
  if(!customer) {
    customer={id:id(),phone:number,created:now.toISOString()};
    db.customers.push(customer);
  }
  customer.name=name;
  customer.address=address;
  return ['daily','weekly'].flatMap(kind=>{
    const items=lines.filter(l=>l.kind===kind);
    if(!items.length) return [];
    const o={id:id(),token:randomBytes(24).toString('base64url'),code:'LS-'+randomBytes(5).toString('hex').toUpperCase(),
      customer:customer.id,name,phone:number,address,group:group.id,groupName:group.name,kind,lines:items,
      created:now.toISOString(),date:schedule.date,week:kind==='weekly'?schedule.saturday:null,
      delivery:kind==='daily'?schedule.date:null,status:states[0],source:actor==='web'?'Web':'Zalo',
      events:[],payments:[],fee:group.fee,deposit:0,expense:0,courier:'',note:clean(input.note)};
    event(o,'Tạo đơn',actor,now);
    db.orders.push(o);
    return [o];
  });
}
export function publicOrder(o) {
  return {code:o.code,kind:o.kind,status:o.status,delivery:o.delivery,week:o.week,created:o.created,
    lines:o.lines.map(({name,qty,unit,price})=>({name,qty,unit,price})),total:total(o),paid:paid(o),fee:o.fee,deposit:o.deposit};
}
export function orderUpdate(db, user, o, b) {
  const transitions={
    admin:[[1,7],[2,7],[3,7],[4,7],[5,6],[ ],[4,7],[]],
    staff:[[],[2],[3],[],[],[],[],[]],
    courier:[[],[],[],[],[5,6],[],[],[]]
  };
  if (b.status!==undefined && b.status!==o.status) {
    check(transitions[user.role][states.indexOf(o.status)].includes(states.indexOf(b.status)),'Không thể chuyển sang trạng thái này.');
    if (b.status===states[4]) check(o.courier&&o.delivery,'Hãy phân người giao và chọn ngày giao.');
    if (b.status===states[5]) o.delivered=new Date().toISOString();
    o.status=b.status;
    event(o,b.status,user.name);
  }
  if(user.role!=='admin') return;
  if(b.delivery!==undefined) {
    const sunday=o.week?new Date(Date.parse(o.week)+86400000).toISOString().slice(0,10):null;
    check(b.delivery===''|| (o.kind==='weekly'?[o.week,sunday].includes(b.delivery):b.delivery===o.date),'Chọn ngày giao đúng lịch đơn.');
    o.delivery=b.delivery||null;
  }
  if(b.courier!==undefined) {
    check(!b.courier||db.users.some(u=>u.id===b.courier&&u.role==='courier'),'Người giao không hợp lệ.');
    o.courier=b.courier;
  }
  if(b.fee!==undefined) o.fee=b.fee===''?null:amount(b.fee);
  check(paid(o)<=total(o),'Phí mới khiến tổng đơn thấp hơn tiền đã thu.');
  if(b.expense!==undefined) o.expense=amount(b.expense);
  if(b.deposit!==undefined) {
    o.deposit=amount(b.deposit);
    check(o.deposit<=total(o)&&(o.kind==='weekly'||!o.deposit),'Mức cọc không hợp lệ.');
  }
  if(b.payment!==undefined&&b.payment!=='') {
    const payment=amount(b.payment);
    check(payment>0&&payment<=total(o)-paid(o),'Số tiền thu phải lớn hơn 0 và không vượt số còn lại.');
    o.payments.push({amount:payment,at:new Date().toISOString(),actor:user.name});
    event(o,'Ghi nhận thu '+payment+' ₫',user.name);
  }
  if(Object.keys(b).some(k=>!['status','payment'].includes(k))) event(o,'Cập nhật thông tin đơn',user.name);
}
export function purchasePreview(db, week) {
  const rows=new Map();
  const covered=new Set(db.purchases.filter(p=>p.week===week).flatMap(p=>p.rows.flatMap(r=>r.refs.map(x=>x.order+'/'+r.product))));
  for(const o of db.orders.filter(o=>o.week===week&&states.indexOf(o.status)>=1&&o.status!==states[7])) {
    for(const l of o.lines) {
      if(covered.has(o.id+'/'+l.id)) continue;
      const key=JSON.stringify([l.supplier,o.group,l.id,l.cost]);
      const row=rows.get(key)??{supplier:l.supplier,group:o.group,product:l.id,name:l.name,unit:l.unit,cost:l.cost,qty:0,received:0,refs:[]};
      row.qty+=l.qty;
      row.refs.push({order:o.id,code:o.code,qty:l.qty});
      rows.set(key,row);
    }
  }
  return [...rows.values()];
}
