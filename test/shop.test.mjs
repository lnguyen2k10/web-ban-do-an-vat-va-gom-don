import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {calendar,orderUpdate,place,purchasePreview,seed,states} from '../domain.mjs';

const thursday='2026-11-19';
test('Chốt ngày thường và đợt gom theo giờ Việt Nam',()=>{
  assert.deepEqual(calendar(new Date(thursday+'T09:59:59Z')),{date:thursday,daily:true,weekly:true,saturday:'2026-11-21',sunday:'2026-11-22'});
  assert.deepEqual(calendar(new Date(thursday+'T10:00:00Z')),{date:thursday,daily:false,weekly:false,saturday:'2026-11-28',sunday:'2026-11-29'});
  assert.equal(calendar(new Date('2026-11-21T04:00:00Z')).saturday,'2026-11-28');
});
test('Tách lịch, nối hồ sơ theo điện thoại và gom từng cụm',()=>{
  const db=seed(), [daily,,weekly]=db.products, now=new Date(thursday+'T09:10:00Z');
  const customer={name:'Khách thử',phone:'0901234567',address:'Địa chỉ thử',group:db.groups[0].id};
  const orders=place(db,{...customer,lines:[{id:daily.id,qty:1},{id:weekly.id,qty:2}]},'web',now);
  assert.deepEqual(orders.map(o=>o.kind),['daily','weekly']);
  const extra=place(db,{...customer,phone:'+84901234567',group:db.groups[1].id,lines:[{id:weekly.id,qty:3}]},'web',now)[0];
  assert.equal(db.customers.length,1);
  const admin={role:'admin',name:'Chủ shop'};
  for(const o of [orders[1],extra])orderUpdate(db,admin,o,{status:states[1]});
  const rows=purchasePreview(db,'2026-11-21');
  assert.deepEqual(rows.map(r=>[r.group,r.qty]),[[db.groups[0].id,2],[db.groups[1].id,3]]);
  db.purchases.push({week:'2026-11-21',rows:[rows[0]]});
  assert.equal(purchasePreview(db,'2026-11-21').length,1);
  assert.throws(()=>place(db,{...customer,lines:[{id:weekly.id,qty:1}]},'web',new Date(thursday+'T10:00:00Z')),/17h/);
});
test('Máy chủ lưu đơn, kiểm soát vai trò và tính báo cáo',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'lees-test-'));
  const url=process.env.TEST_DATABASE_URL;
  const env={...process.env,DB_ENGINE:url?'postgres':'sqlite',DATABASE_URL:url||'',DB_SKIP_MIGRATIONS:'0',HOST:'127.0.0.1',PORT:'0',DB_PATH:join(dir,'shop.sqlite'),ADMIN_LOGIN:'admin',ADMIN_PASSWORD:'testing-setup-2026',COOKIE_SECURE:'0',PUBLIC_URL:'',TELEGRAM_BOT_TOKEN:''};
  let child;
  t.after(async()=>{if(child?.exitCode===null){child.kill();await once(child,'exit');}await rm(dir,{recursive:true,force:true});});
  async function start(){
    child=spawn(process.execPath,['server.mjs'],{env,stdio:['ignore','pipe','inherit']});
    const [chunk]=await once(child.stdout,'data');
    return 'http://127.0.0.1:'+String(chunk).match(/listening on (\d+)/)[1];
  }
  let base=await start();
  let cookie='';
  async function call(path,data,method=data===undefined?'GET':'POST',identity=cookie){
    const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',cookie:identity},body:data===undefined?undefined:JSON.stringify(data)});
    return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
  }
  const catalog=(await call('/api/catalog')).body;
  assert.equal(catalog.products.length,5);
  assert.equal(catalog.products[0].cost,undefined);
  assert.equal((await call('/api/manage')).status,401);
  cookie=(await call('/api/login',{login:'admin',password:env.ADMIN_PASSWORD})).cookie;
  assert.ok(cookie);
  const qr=await fetch(base+'/api/manage/qr?group='+catalog.groups[0].id,{headers:{cookie}});
  assert.match(await qr.text(),/<svg/);
  const template=await fetch(base+'/api/manage/template',{headers:{cookie}});
  assert.equal(Buffer.from(await template.arrayBuffer()).subarray(0,2).toString(),'PK');
  const created=await call('/api/manage/order',{name:'Người thử',address:'12 Nguyễn Gia Trí',phone:'0901234567',group:catalog.groups[0].id,lines:[{id:catalog.products[0].id,qty:2}]});
  assert.equal(created.status,201);
  await call('/api/manage/user',{login:'ship',name:'Người giao',role:'courier',password:'testing-courier-2026'});
  await call('/api/manage/user',{login:'pack',name:'Người soạn',role:'staff',password:'testing-packer-2026'});
  const shop=(await call('/api/manage')).body, o=shop.orders[0];
  const courier=shop.users.find(u=>u.login==='ship');
  const ship=(await call('/api/login',{login:'ship',password:'testing-courier-2026'})).cookie;
  const pack=(await call('/api/login',{login:'pack',password:'testing-packer-2026'})).cookie;
  const patch=(data,identity)=>call('/api/manage/order/'+o.id,data,'PATCH',identity);
  assert.equal((await call('/api/manage',undefined,'GET',ship)).body.orders.length,0);
  assert.equal((await call('/api/manage/report',undefined,'GET',ship)).status,403);
  assert.equal((await patch({status:states[5]},ship)).status,404);
  assert.equal((await patch({status:states[1]})).status,200);
  assert.equal((await call('/api/manage',undefined,'GET',pack)).body.orders[0].phone,undefined);
  assert.equal((await patch({status:states[2]},pack)).status,200);
  assert.equal((await patch({status:states[3]},pack)).status,200);
  assert.equal((await patch({courier:courier.id,fee:5000,expense:4000})).status,200);
  assert.equal((await patch({status:states[4]})).status,200);
  const result=(await call('/api/manage',undefined,'GET',ship)).body.orders[0];
  assert.equal(result.due,55000);
  assert.equal(result.lines,undefined);
  assert.equal((await patch({status:states[5]},ship)).status,200);
  assert.equal((await patch({payment:55000})).status,200);
  const report=(await call('/api/manage/report?by=order')).body[0];
  assert.deepEqual([report.revenue,report.received,report.cost,report.expenses,report.profit],[55000,55000,26000,4000,25000]);
  const batch=await Promise.all(Array.from({length:6},(_,i)=>call('/api/manage/order',{
    name:'Đơn song song '+i,address:'Nguyễn Gia Trí',phone:'0901234567',group:catalog.groups[0].id,
    lines:[{id:catalog.products[1].id,qty:1}]
  })));
  assert.ok(batch.every(r=>r.status===201));
  assert.equal((await call('/api/manage')).body.orders.length,7);
  child.kill();await once(child,'exit');
  base=await start();
  assert.equal((await call('/api/manage')).body.orders.find(order=>order.id===o.id).status,states[5]);
});
