import {createServer} from 'node:http';
import {createHash,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {extname} from 'node:path';
import ExcelJS from 'exceljs';
import QRCode from 'qrcode';
import { waitUntil } from '@vercel/functions';
import {amount,calendar,check,clean,id,orderUpdate,paid,place,publicOrder,purchasePreview,seed,states,total} from './domain.mjs';

import {initShop,loadShop,openStorage,writeShop} from './db/storage.mjs';

let storage;
try {
  storage=await openStorage();
  await initShop(storage,seed);
} catch(error) {
  console.error('Không khởi tạo được cơ sở dữ liệu:',error.code||error.name);
  if(storage) await storage.close();
  throw error;
}
const load=()=>loadShop(storage);
const write=fn=>writeShop(storage,fn);
const hash=v=>createHash('sha256').update(v).digest('hex');
function password(v){
  check(typeof v==='string'&&v.length>=12&&v.length<=200,'Mật khẩu cần 12–200 ký tự.');
  const salt=randomBytes(16).toString('hex');
  return salt+':'+scryptSync(v,salt,64).toString('hex');
}
function verify(v,key){
  if(typeof v!=='string'||v.length>200||!key) return false;
  const [salt,digest]=key.split(':');
  return timingSafeEqual(scryptSync(v,salt,64),Buffer.from(digest,'hex'));
}
const bootstrap=process.env.ADMIN_PASSWORD;
if(bootstrap&&!(await load()).users.length) await write(db=>{
  if(!db.users.length) db.users.push({id:id(),login:(process.env.ADMIN_LOGIN||'admin').toLowerCase(),name:'Chủ shop',role:'admin',password:password(bootstrap)});
});
const safeUser=({id,name,role,login})=>({id,name,role,login});
const limits=new Map();
function limit(key,max){
  const now=Date.now();
  if(limits.size>2000) for(const [k,v] of limits) if(v.until<now) limits.delete(k);
  let v=limits.get(key);
  if(!v||v.until<now){v={until:now+600000,count:0};limits.set(key,v);}
  check(++v.count<=max,'Thử lại sau ít phút.',429);
}
async function body(req, cap=2000000){
  const chunks=[];let size=0;
  for await(const c of req){size+=c.length;check(size<=cap,'Tệp hoặc nội dung quá lớn.',413);chunks.push(c);}
  return Buffer.concat(chunks);
}
async function json(req){
  let b;
  try {b=JSON.parse((await body(req,4000000)).toString());}
  catch(e){if(e.status) throw e;check(false,'Nội dung không hợp lệ.');}
  check(b&&typeof b==='object'&&!Array.isArray(b),'Nội dung không hợp lệ.');
  return b;
}
function photo(v){
  return /^\/img\/[a-z-]+\.jpg$/.test(v)||/^https:\/\/[^\s]+$/i.test(v)||/^data:image\/(jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(v);
}
function product(db,b,editing){
  const name=clean(b.name,120), sku=clean(b.sku,40).toUpperCase(), unit=clean(b.unit,50);
  const images=Array.isArray(b.images)?b.images.filter(Boolean):[];
  const price=amount(b.price), cost=amount(b.cost);
  const promo=b.promo==null||b.promo===''?null:amount(b.promo);
  check(name&&sku&&unit&&['daily','weekly'].includes(b.kind),'Điền mã, tên, quy cách và nhóm món.');
  check(!db.products.some(p=>p.sku===sku&&p.id!==editing),'Mã sản phẩm đã tồn tại.');
  check(price>0&&(promo===null||promo<price),'Giá ưu đãi phải thấp hơn giá bán.');
  check(images.length>=1&&images.length<=3&&images.every(v=>typeof v==='string'&&v.length<=900000&&photo(v)),'Cần 1–3 ảnh JPG, PNG, WebP hoặc đường dẫn HTTPS.');
  check(db.suppliers.some(s=>s.id===b.supplier),'Chọn nhà cung cấp.');
  return {id:editing||id(),sku,name,unit,kind:b.kind,price,cost,promo,description:clean(b.description,1200),images,supplier:b.supplier,active:b.active!==false};
}
const excelKeys=['sku','name','unit','kind','price','promo','cost','supplier','description','image1','image2','image3'];
async function parseExcel(req){
  const book=new ExcelJS.Workbook();
  try{await book.xlsx.load(await body(req));}catch(e){if(e.status) throw e;check(false,'Không đọc được tệp XLSX.');}
  const sheet=book.worksheets[0];
  check(sheet&&sheet.rowCount<=501,'Cần một bảng tối đa 500 dòng sản phẩm.');
  check(excelKeys.every((k,i)=>sheet.getRow(1).getCell(i+1).text.trim()===k),'Dùng đúng các cột trong tệp Excel mẫu.');
  const rows=[];
  sheet.eachRow((r,i)=>{
    if(i===1) return;
    const data=Object.fromEntries(excelKeys.map((k,j)=>[k,r.getCell(j+1).text.trim()]));
    if(Object.values(data).some(Boolean)) rows.push({i,...data,images:[data.image1,data.image2,data.image3].filter(Boolean)});
  });
  check(rows.length>0,'Tệp chưa có sản phẩm.');
  return rows;
}
function importRows(db,rows){
  const result=[], errors=[];
  for(const b of rows){
    try{const p=product(db,b);db.products.push(p);result.push({sku:p.sku,name:p.name});}
    catch(e){errors.push({row:b.i,message:e.message});}
  }
  return {result,errors};
}
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(v=>v.trim().split('=')));
async function auth(req,db){
  const sid=cookies(req).lees_session;
  const session=sid&&await storage.get('SELECT user_id AS account FROM lees_shop.sessions WHERE token=? AND expiry>?',hash(sid),Date.now());
  return session&&db.users.find(u=>u.id===session.account);
}
const secure=process.env.COOKIE_SECURE==='1'?'; Secure':'';
async function notify(orders){
  const token=process.env.TELEGRAM_BOT_TOKEN, chat=process.env.TELEGRAM_CHAT_ID;
  if(!token||!chat) return;
  const message=orders.map(o=>o.code+' · '+o.groupName+' · '+total(o).toLocaleString('vi-VN')+' ₫').join('\n');
  const response=await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat_id:chat,text:'Đơn mới Lee’s Shop\n'+message+(process.env.PUBLIC_URL?'\n'+process.env.PUBLIC_URL.replace(/\/$/,'')+'/admin':'')}),signal:AbortSignal.timeout(6500)});
  if(!response.ok) throw new Error('Telegram HTTP '+response.status);
}
let flushing=false;
async function flushNotifications(){
  if(flushing||!process.env.TELEGRAM_BOT_TOKEN||!process.env.TELEGRAM_CHAT_ID) return;
  flushing=true;
  try {
    const rows=await storage.all('SELECT * FROM lees_shop.notifications WHERE next_try<=? ORDER BY next_try LIMIT 10',Date.now());
    for(const row of rows){
      const now=Date.now();
      const claimed=await storage.run('UPDATE lees_shop.notifications SET next_try=? WHERE id=? AND next_try<=?',now+120000,row.id,now);
      if(!claimed) continue;
      try{
        const ids=new Set(JSON.parse(row.order_ids));
        await notify((await load()).orders.filter(o=>ids.has(o.id)));
        await storage.run('DELETE FROM lees_shop.notifications WHERE id=?',row.id);
      }catch(e){
        const next=Date.now()+Math.min(3600000,15000*2**Math.min(row.attempts,8));
        await storage.run('UPDATE lees_shop.notifications SET attempts=attempts+1,next_try=? WHERE id=?',next,row.id);
        console.error('Thông báo Telegram sẽ thử lại:',e.name);
      }
    }
  }finally{flushing=false;}
}
if(!process.env.VERCEL) setInterval(()=>void flushNotifications().catch(console.error),15000).unref();
function dispatchNotifications(){
  const task=flushNotifications().catch(console.error);
  if(process.env.VERCEL) waitUntil(task);
}
const rates=req=>(process.env.VERCEL?req.headers['x-vercel-forwarded-for']?.split(',')[0].trim():null)||req.socket.remoteAddress||'unknown';
const send=(res,data,status=200,headers={})=>{
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});
  res.end(JSON.stringify(data));
};
function report(db,params){
  const from=params.get('from')||'',to=params.get('to')||'9999',customer=params.get('customer')||'',by=params.get('by')||'day';
  const buckets=new Map();
  const group=(date,o)=>by==='month'?date.slice(0,7):by==='customer'?o?.customer||'Chi phí chung':by==='order'?o?.code||'Chi phí chung':date;
  function row(date,o){
    const key=group(date,o);
    if(!buckets.has(key)) buckets.set(key,{key:by==='customer'&&o?o.name+' · '+o.phone:key,revenue:0,received:0,cost:0,expenses:0});
    return buckets.get(key);
  }
  const date=at=>calendar(new Date(at)).date;
  const within=d=>d>=from&&d<=to;
  for(const o of db.orders.filter(o=>!customer||o.customer===customer)){
    if(o.delivered&&within(date(o.delivered))){
      const r=row(date(o.delivered),o);
      r.revenue+=total(o);r.cost+=o.lines.reduce((n,l)=>n+l.cost*l.qty,0);r.expenses+=o.expense;
    }
    for(const p of o.payments) if(within(date(p.at))) row(date(p.at),o).received+=p.amount;
  }
  if(!customer) for(const x of db.expenses) if(within(x.date)) row(x.date).expenses+=x.amount;
  return [...buckets.values()].map(r=>({...r,profit:r.revenue-r.cost-r.expenses})).sort((a,b)=>b.key.localeCompare(a.key));
}
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
async function api(req,res,url){
  const p=url.pathname,m=req.method,q=url.searchParams;
  const db=await load(),user=await auth(req,db);
  if(m==='GET'&&p==='/api/catalog'&&process.env.VERCEL) dispatchNotifications();
  if(m==='GET'&&p==='/api/catalog') return send(res,{schedule:calendar(),products:db.products.filter(p=>p.active).map(({cost,supplier,...p})=>p),
    groups:db.groups.filter(g=>g.active).map(({hub,...g})=>g),zalo:process.env.ZALO_URL||''});
  if(m==='POST'&&p==='/api/orders'){
    limit('order:'+rates(req),40);
    const b=await json(req);
    const key=clean(b.requestKey,60);
    check(/^[0-9a-f-]{36}$/i.test(key),'Tải lại giỏ hàng trước khi gửi đơn.');
    const fingerprint=hash(JSON.stringify(b));
    const orders=await write(async (db,tx)=>{
      const previous=await tx.get('SELECT * FROM lees_shop.checkout WHERE key=?',key);
      if(previous){
        check(previous.fingerprint===fingerprint,'Giỏ hàng đã thay đổi. Vui lòng gửi lại.',409);
        const ids=new Set(JSON.parse(previous.order_ids));
        return db.orders.filter(o=>ids.has(o.id));
      }
      const result=place(db,b,'web');
      const ids=JSON.stringify(result.map(o=>o.id));
      await tx.run('INSERT INTO lees_shop.checkout (key,fingerprint,order_ids) VALUES (?,?,?)',key,fingerprint,ids);
      await tx.run('INSERT INTO lees_shop.notifications (id,order_ids,next_try,attempts) VALUES (?,?,?,0)',id(),ids,Date.now());
      return result;
    });
    dispatchNotifications();
    return send(res,orders.map(o=>({...publicOrder(o),token:o.token})),201);
  }
  if(m==='GET'&&p==='/api/track'){
    limit('track:'+rates(req),180);
    const o=db.orders.find(o=>o.token===q.get('token'));
    check(o,'Không tìm thấy đơn.',404);
    return send(res,publicOrder(o));
  }
  if(m==='POST'&&p==='/api/login'){
    limit('login:'+rates(req),15);
    const b=await json(req), login=clean(b.login).toLowerCase();
    const u=db.users.find(u=>u.login===login);
    check(u&&verify(b.password,u.password),'Tên đăng nhập hoặc mật khẩu không đúng.',401);
    const s=randomBytes(32).toString('base64url'), expiry=Date.now()+43200000;
    await storage.run('DELETE FROM lees_shop.sessions WHERE expiry<=?',Date.now());
    await storage.run('INSERT INTO lees_shop.sessions (token,user_id,expiry) VALUES (?,?,?)',hash(s),u.id,expiry);
    return send(res,safeUser(u),200,{'Set-Cookie':'lees_session='+s+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200'+secure});
  }
  check(user,'Đăng nhập để tiếp tục.',401);
  if(p==='/api/logout'&&m==='POST'){
    await storage.run('DELETE FROM lees_shop.sessions WHERE token=?',hash(cookies(req).lees_session));
    return send(res,{ok:true},200,{'Set-Cookie':'lees_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'+secure});
  }
  const canSee=o=>user.role==='admin'||(user.role==='courier'?o.courier===user.id&&[4,5,6].includes(states.indexOf(o.status)):[1,2,3,4,5,6].includes(states.indexOf(o.status)));
  if(p==='/api/manage'&&m==='GET'){
    const orders=db.orders.filter(canSee).reverse().map(o=>{
      if(user.role==='admin') {const {token,...rest}=o;return rest;}
      const {id,code,name,date,delivery,week,groupName,status,kind}=o;
      return {id,code,name,date,delivery,week,groupName,status,kind,...(user.role==='courier'?{phone:o.phone,address:o.address,due:total(o)-paid(o)}:{lines:o.lines.map(({name,unit,qty})=>({name,unit,qty}))})};
    });
    return send(res,{user:safeUser(user),orders,...(user.role==='admin'?{products:db.products,groups:db.groups,suppliers:db.suppliers,users:db.users.map(safeUser),customers:db.customers,purchases:db.purchases,expenses:db.expenses}:{}),schedule:calendar()});
  }
  if(p.startsWith('/api/manage/order/')&&m==='PATCH'){
    const b=await json(req);
    return send(res,await write(db=>{
      const o=db.orders.find(o=>o.id===p.split('/').at(-1));
      check(o&&canSee(o),'Không tìm thấy đơn.',404);
      orderUpdate(db,user,o,b);
      return {ok:true};
    }));
  }
  check(user.role==='admin','Tài khoản không có quyền truy cập.',403);
  if(p==='/api/manage/order'&&m==='POST'){
    const b=await json(req);
    return send(res,(await write(db=>place(db,b,user.name))).map(publicOrder),201);
  }
  if(p==='/api/manage/report'&&m==='GET') return send(res,report(db,q));
  if(p==='/api/manage/qr'&&m==='GET'){
    const group=db.groups.find(g=>g.id===q.get('group'));
    check(group,'Không tìm thấy cụm.',404);
    const link=new URL('/dat-hang',process.env.PUBLIC_URL||'http://'+req.headers.host);
    link.searchParams.set('cum',group.id);
    const svg=await QRCode.toString(link.href,{type:'svg',errorCorrectionLevel:'M',margin:3});
    res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'no-store'});
    return res.end(svg);
  }
  if(p==='/api/manage/template'&&m==='GET'){
    const book=new ExcelJS.Workbook(), sheet=book.addWorksheet('Sản phẩm');
    sheet.addRow(excelKeys);
    sheet.columns.forEach(c=>c.width=23);
    res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="lees-shop-san-pham.xlsx"'});
    return res.end(Buffer.from(await book.xlsx.writeBuffer()));
  }
  if(p==='/api/manage/import'&&m==='POST'){
    const rows=await parseExcel(req);
    if(q.get('apply')!=='1') return send(res,importRows(db,rows));
    return send(res,await write(db=>{const out=importRows(db,rows);check(!out.errors.length,'Tệp có dòng lỗi. Hãy xem trước và sửa rồi nhập lại.');return out;}));
  }
  if(p==='/api/manage/purchases/preview'&&m==='GET') return send(res,purchasePreview(db,q.get('week')));
  check(m==='POST','Không tìm thấy chức năng.',404);
  const b=await json(req);
  return send(res,await write(db=>{
    if(p==='/api/manage/product'){
      const existing=b.id&&db.products.find(p=>p.id===b.id);
      check(!b.id||existing,'Không tìm thấy sản phẩm.',404);
      const value=product(db,b,existing?.id);
      if(existing) Object.assign(existing,value);else db.products.push(value);
    }else if(p==='/api/manage/group'){
      const key=clean(b.id,60),name=clean(b.name,100),zalo=clean(b.zalo);
      check(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(key)&&name,'Điền mã cụm và tên hiển thị.');
      check(!zalo||/^https:\/\/zalo\.me\//i.test(zalo),'Link nhóm phải bắt đầu bằng https://zalo.me/.');
      const g=db.groups.find(g=>g.id===key);
      const value={id:key,name,zalo,hub:clean(b.hub),area:clean(b.area),active:b.active!==false,fee:b.fee===''||b.fee==null?null:amount(b.fee)};
      if(g)Object.assign(g,value);else db.groups.push(value);
    }else if(p==='/api/manage/supplier'){
      const existing=b.id&&db.suppliers.find(s=>s.id===b.id),name=clean(b.name,120);
      check(name&&(!b.id||existing),'Điền tên nhà cung cấp.');
      const value={id:existing?.id||id(),name,phone:clean(b.phone,50),address:clean(b.address)};
      if(existing)Object.assign(existing,value);else db.suppliers.push(value);
    }else if(p==='/api/manage/user'){
      const login=clean(b.login,80).toLowerCase(),name=clean(b.name,90);
      check(/^[a-z0-9_.-]{3,80}$/.test(login)&&name&&['admin','staff','courier'].includes(b.role),'Điền tên, tên đăng nhập và vai trò hợp lệ.');
      check(!db.users.some(u=>u.login===login),'Tên đăng nhập đã tồn tại.');
      db.users.push({id:id(),login,name,role:b.role,password:password(b.password)});
    }else if(p==='/api/manage/purchase'){
      check(validDate(b.week)&&new Date(b.week).getUTCDay()===6,'Chọn ngày thứ Bảy của đợt.');
      const c=calendar();
      check(b.week<c.saturday,'Chỉ lập phiếu sau khi chốt đợt lúc 17h thứ Năm.');
      const rows=purchasePreview(db,b.week), supplier=db.suppliers.find(s=>s.id===b.supplier), hub=clean(b.hub);
      check(supplier,'Chọn nhà cung cấp.');
      const selected=rows.filter(r=>r.supplier===supplier.id&&(b.group==='all'||r.group===b.group));
      check(selected.length,'Không có món cần đặt cho lựa chọn này.');
      check(hub||selected.every(r=>db.groups.find(g=>g.id===r.group)?.hub),'Điền điểm nhận chung hoặc cập nhật điểm tập kết của từng cụm.');
      for(const row of selected){
        row.groupName=db.groups.find(g=>g.id===row.group)?.name||row.group;
        row.destination=hub||db.groups.find(g=>g.id===row.group).hub;
      }
      db.purchases.push({id:id(),supplier:supplier.name,week:b.week,rows:selected,paid:0,created:new Date().toISOString()});
    }else if(p==='/api/manage/purchase/update'){
      const x=db.purchases.find(x=>x.id===b.id);
      check(x,'Không tìm thấy phiếu.',404);
      check(Array.isArray(b.received)&&b.received.length===x.rows.length,'Dữ liệu nhận hàng không hợp lệ.');
      x.rows.forEach((r,i)=>{r.received=amount(b.received[i],r.qty);});
      x.paid=amount(b.paid,x.rows.reduce((sum,r)=>sum+r.cost*r.qty,0));
    }else if(p==='/api/manage/expense'){
      const name=clean(b.name,120);
      check(name&&validDate(b.date),'Điền tên chi phí và ngày.');
      db.expenses.push({id:id(),name,date:b.date,amount:amount(b.amount)});
    }else check(false,'Không tìm thấy chức năng.',404);
    return {ok:true};
  }));
}
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.svg':'image/svg+xml'};
export async function handleRequest(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; base-uri 'none'; form-action 'self'");
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/api/')){
      if(['POST','PATCH'].includes(req.method)){
        check(req.headers['sec-fetch-site']!=='cross-site','Yêu cầu bị từ chối.',403);
        const expected=process.env.PUBLIC_URL?new URL(process.env.PUBLIC_URL).host:req.headers.host;
        check(!req.headers.origin||new URL(req.headers.origin).host===expected,'Yêu cầu bị từ chối.',403);
      }
      return await api(req,res,url);
    }
    const name=({ '/':'/index.html','/dat-hang':'/index.html','/admin':'/admin.html','/tra-don':'/track.html' })[url.pathname]||url.pathname;
    const type=types[extname(name)];
    check(type&&/^\/(?:img\/)?[a-z.-]+$/.test(name),'Không tìm thấy trang.',404);
    const file=readFileSync(new URL('./public'+name,import.meta.url));
    res.writeHead(200,{'Content-Type':type,'Cache-Control':name.endsWith('.jpg')?'public, max-age=86400':'no-cache'});
    res.end(file);
  }catch(e){
    const status=e.status||(e.code==='ENOENT'?404:500);
    if(status===500) console.error(e);
    if(!res.headersSent) send(res,{error:status===500?'Có lỗi hệ thống. Vui lòng thử lại.':status===404?'Không tìm thấy nội dung.':e.message},status);
    else res.end();
  }
}
if (!process.env.VERCEL) {
  const server=createServer(handleRequest);
  server.listen(Number(process.env.PORT||3000),process.env.HOST||'0.0.0.0',()=>console.log('Lee’s Shop listening on '+server.address().port+' ('+storage.kind+')'));
}
