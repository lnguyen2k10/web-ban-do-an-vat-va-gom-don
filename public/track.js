import {$,api,esc,money,date,days,pairs} from './common.js';
function card(o){
  return '<article class="panel"><span class="pill">'+esc(o.status)+'</span><h3>'+esc(o.code)+' · '+days[o.kind]+'</h3><p>Ngày giao: '+(o.delivery?date(o.delivery):o.week?'Cuối tuần từ '+date(o.week):'Chưa xếp lịch')+'</p><ul class="plain-list">'+o.lines.map(l=>'<li>'+esc(l.name)+' · '+l.qty+' × '+money(l.price)+'</li>').join('')+'</ul><p><strong>'+money(o.total)+'</strong>'+(o.fee==null?' · Phí giao sẽ xác nhận':'')+'</p><p>Đã thu '+money(o.paid)+' · Còn lại '+money(o.total-o.paid)+'</p>'+(o.deposit?'<p>Mức cọc '+money(o.deposit)+'</p>':'')+'</article>';
}
if(location.hash.length>1){
  try{$('#order').innerHTML=card(await api('/api/track?token='+encodeURIComponent(location.hash.slice(1))));}
  catch(e){$('#order').textContent=e.message;}
}
$('#lookup').addEventListener('submit',async e=>{
  e.preventDefault();
  const b=e.submitter, v=pairs(e.target), verify=b.name==='verify';
  const error=$('#error');error.textContent='';b.disabled=true;$('#history').replaceChildren();
  try{
    const r=await api('/api/history/'+(verify?'verify':'send'),v);
    if(verify) $('#history').innerHTML=r.map(card).join('')||'<p>Chưa có đơn hàng.</p>';
    else{$('#code-field').hidden=false;$('[name=verify]').hidden=false;$('[name=code]').focus();}
  }catch(err){error.textContent=err.message;}
  finally{b.disabled=false;}
});
