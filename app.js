'use strict';
const KEY='kantong.v1',EXP=['Makan','Transport','Kos & listrik','Kuliah','Hiburan','Lainnya'],INC=['Kiriman orang tua','Kerja sampingan','Beasiswa','Lainnya'];
const COL=['#e4572e','#2a7de1','#0f8b6d','#d99a0b','#c2467a','#6b7a8f'],DAY=['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const col=(c,ty)=>ty==='in'?'#12805f':COL[Math.max(0,EXP.indexOf(c))];
const blank=()=>({tx:[],bud:{},goals:[],debts:[],tasks:[],next:''});
const num=v=>{v=Number(v);return Number.isFinite(v)&&v>=0?Math.min(Math.floor(v),1e12):0};
const str=(v,n=80)=>String(v==null?'':v).slice(0,n);
const dt=v=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return '';const d=new Date(v+'T00:00:00');return Number.isNaN(d.getTime())||d.getFullYear()!==Number(v.slice(0,4))||d.getMonth()+1!==Number(v.slice(5,7))||d.getDate()!==Number(v.slice(8,10))?'':v};
function clean(d){
 const b=blank();
 if(!d||typeof d!=='object'||Array.isArray(d))return b;
 const A=x=>Array.isArray(x)?x.slice(0,5000).filter(v=>v&&typeof v==='object'&&!Array.isArray(v)):[];
 b.tx=A(d.tx).map((t,i)=>{
  const type=t.type==='in'?'in':'out',allowed=type==='in'?INC:EXP;
  return{id:str(t.id,40)||'tx-'+i,date:dt(t.date),type,cat:allowed.includes(t.cat)?t.cat:'Lainnya',amt:num(t.amt),note:str(t.note)};
 }).filter(t=>t.date&&t.amt>0);
 if(d.bud&&typeof d.bud==='object'&&!Array.isArray(d.bud))for(const c of EXP)b.bud[c]=num(d.bud[c]);
 b.goals=A(d.goals).map((g,i)=>({id:str(g.id,40)||'goal-'+i,name:str(g.name,50).trim(),target:num(g.target),saved:num(g.saved)})).filter(g=>g.name&&g.target>0);
 b.debts=A(d.debts).map((x,i)=>({id:str(x.id,40)||'debt-'+i,who:str(x.who,50).trim(),amt:num(x.amt),dir:x.dir==='owe'?'owe':'lent',note:str(x.note),done:!!x.done})).filter(x=>x.who&&x.amt>0);
 b.tasks=A(d.tasks).map((x,i)=>({id:str(x.id,40)||'task-'+i,t:str(x.t,100).trim(),due:dt(x.due),done:!!x.done})).filter(x=>x.t);
 b.next=dt(d.next);return b
}
let S;try{S=clean(JSON.parse(localStorage.getItem(KEY)))}catch(e){S=blank()}
function save(){
 try{
  const cloud=window.KantongCloud;
  const user=window.KANTONG_CURRENT_USER;
  if(cloud&&cloud.isAuthenticated()&&user&&user.id){
   localStorage.setItem('kantong.v1.user.'+user.id,JSON.stringify(S));
   cloud.saveFinance(S).catch(e=>{
    console.error('Kantong sync:',e);
    toast('Perubahan tersimpan di perangkat ini, tetapi belum tersinkron. Periksa internet lalu coba lagi.');
   });
  }else{
   localStorage.setItem(KEY,JSON.stringify(S));
  }
  return true;
 }catch(e){
  setTimeout(()=>toast('Penyimpanan browser gagal atau penuh. Perubahan ini belum tersimpan permanen; unduh cadangan.'),0);
  return false;
 }
}
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const rp=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
const pad=n=>String(n).padStart(2,'0');
const dAgo=n=>{const d=new Date();d.setDate(d.getDate()-n);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const today=()=>dAgo(0);
const fmtD=s=>new Date(s+'T00:00:00').toLocaleDateString('id-ID',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
const sum=(a,ty)=>a.filter(t=>t.type===ty).reduce((s,t)=>s+t.amt,0);
const $=s=>document.querySelector(s);
function h(t,a,...c){const e=document.createElement(t);for(const k in a||{}){if(k.startsWith('on'))e.addEventListener(k.slice(2),a[k]);else e.setAttribute(k,a[k])}c.flat().forEach(x=>e.append(x==null?'':x));return e}
const sv=(t,a,...c)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',t);for(const k in a)e.setAttribute(k,a[k]);c.forEach(x=>e.append(x));return e};
const ic=p=>{const s=sv('svg',{viewBox:'0 0 24 24',width:20,height:20,fill:'none',stroke:'currentColor','stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'});p.split('|').forEach(d=>s.append(sv('path',{d})));return s};
const IC={beranda:'M3 11l9-8 9 8|M5 10v10h14V10',transaksi:'M8 6h13|M8 12h13|M8 18h13|M3 6h.01|M3 12h.01|M3 18h.01',anggaran:'M21 12A9 9 0 1 1 12 3v9z',tabungan:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18|M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',utang:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8|M22 21v-2a4 4 0 0 0-3-3.9|M16 3.1a4 4 0 0 1 0 7.8',tugas:'M5 12l5 5L20 7',data:'M12 3v12|M7 10l5 5 5-5|M4 21h16',myspace:'M4 4h16v16H4z|M8 8h8|M8 12h8|M8 16h5',plus:'M12 5v14|M5 12h14'};
function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,2800)}
const fld=(l,i)=>h('label',{class:'f'},h('span',{},l),i);
const bar=(v,max,c)=>{const p=max>0?v/max:0;return h('div',{class:'bar'+(p>1?' over':'')},h('i',{style:'width:'+Math.min(100,p*100)+'%'+(c&&p<=1?';background:'+c:'')}))};
const sel=o=>h('select',{},o.map(x=>h('option',{value:x[0]},x[1])));
const empty=m=>h('p',{class:'empty'},m);
const head=(t,s,a)=>h('div',{class:'head'},h('div',{},h('h1',{},t),h('p',{class:'mute'},s)),a||'');
const del=(k,id)=>{S[k]=S[k].filter(x=>x.id!==id);save()};
const txRow=(t,onDel)=>h('div',{class:'li'},h('i',{class:'dot',style:'background:'+col(t.cat,t.type)},t.cat[0]||'?'),
 h('div',{},t.cat,h('small',{},t.note||fmtD(t.date))),h('span',{class:'amt '+t.type},(t.type==='in'?'+ ':'− ')+rp(t.amt)),
 onDel?h('button',{class:'lk','aria-label':'Hapus transaksi '+t.cat,onclick:()=>{if(confirm('Hapus transaksi ini?'))onDel(t.id)}},'Hapus'):h('span'));
const V={};
V.myspace=()=>window.renderMySpace();

function openAdd(){
 let ty='out',ct=EXP[0];const d=$('#dq');
 const amt=h('input',{type:'number',min:'1',max:'1000000000',inputmode:'numeric',placeholder:'0',required:'','aria-label':'Nominal (Rp)',class:'amt-in'});
 const date=h('input',{type:'date',value:today(),required:''}),note=h('input',{maxlength:'80',placeholder:'mis. nasi ayam dan es teh'});
 const seg=h('div',{class:'seg',role:'group','aria-label':'Jenis'}),chips=h('div',{class:'chips',role:'group','aria-label':'Kategori'});
 const dC=()=>chips.replaceChildren(...(ty==='in'?INC:EXP).map(c=>h('button',{type:'button',class:'chip','aria-pressed':String(c===ct),onclick:()=>{ct=c;dC()}},c)));
 const dS=()=>seg.replaceChildren(...[['out','Pengeluaran'],['in','Pemasukan']].map(([k,l])=>h('button',{type:'button','aria-pressed':String(k===ty),onclick:()=>{ty=k;ct=(k==='in'?INC:EXP)[0];dS();dC()}},l)));
 dS();dC();
 const quick=h('div',{class:'chips'},[5000,10000,20000,50000].map(v=>h('button',{type:'button',class:'chip',onclick:()=>{amt.value=num(amt.value)+v}},'+'+v/1000+'rb')));
 d.replaceChildren(h('form',{onsubmit:e=>{e.preventDefault();const a=num(amt.value);if(!a||!dt(date.value))return toast('Isi nominal dan tanggal dengan benar.');
  S.tx.push({id:uid(),date:date.value,type:ty,cat:ct,amt:a,note:str(note.value)});save();d.close();route();toast('Transaksi disimpan.')}},
  h('h2',{style:'margin-top:0'},'Catat transaksi'),seg,h('div',{style:'margin-top:1rem'},amt),quick,chips,
  h('div',{class:'row',style:'margin-top:.6rem'},fld('Tanggal',date),fld('Catatan (opsional)',note)),
  h('div',{class:'acts'},h('button',{type:'button',class:'btn ghost',onclick:()=>d.close()},'Batal'),h('button',{type:'submit',class:'btn'},'Simpan'))));
 d.showModal();amt.focus()}

V.beranda=()=>{
 const T=today(),mt=S.tx.filter(t=>t.date.startsWith(T.slice(0,7)));
 const inc=sum(mt,'in'),exp=sum(mt,'out'),bal=sum(S.tx,'in')-sum(S.tx,'out');
 const days=S.next?Math.round((new Date(S.next+'T00:00:00')-new Date(T+'T00:00:00'))/864e5):0;
 const ts=sum(S.tx.filter(t=>t.date===T),'out'),per=days>0?Math.floor((bal+ts)/days):0,left=per-ts;
 const hero=h('section',{class:'hero'},h('p',{class:'k'},days>0?'Sisa jatah hari ini':'Saldo kamu'),
  h('p',{class:'big'+(days>0&&left<0?' neg':'')},rp(days>0?left:bal)),
  days>0?[bar(ts,Math.max(per,1)),h('p',{class:'sm',style:'margin-top:.5rem'},'Sudah keluar '+rp(ts)+' dari jatah '+rp(Math.max(per,0))+'. Kiriman berikutnya '+days+' hari lagi.')]:h('p',{class:'sm'},'Atur tanggal kiriman di menu Data untuk melihat jatah harian.'),
  h('div',{class:'stats'},[['Saldo',bal],['Masuk bulan ini',inc],['Keluar bulan ini',exp]].map(([k,v])=>h('div',{},h('span',{},k),h('b',{},rp(v))))));
 const cats=EXP.map(c=>[c,sum(mt.filter(t=>t.cat===c),'out')]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);
 const dn=sv('svg',{viewBox:'0 0 42 42',class:'donut',role:'img','aria-label':'Diagram pengeluaran per kategori'});
 dn.append(sv('circle',{cx:21,cy:21,r:15.9155,fill:'none',stroke:'var(--bg)','stroke-width':6}));let off=25;
 cats.forEach(([c,v])=>{const p=v/exp*100;dn.append(sv('circle',{cx:21,cy:21,r:15.9155,fill:'none',stroke:col(c),'stroke-width':6,'stroke-dasharray':p+' '+(100-p),'stroke-dashoffset':off}));off-=p});
 const wk=[6,5,4,3,2,1,0].map(n=>{const d=dAgo(n);return[d,sum(S.tx.filter(t=>t.date===d),'out')]}),mx=Math.max(...wk.map(x=>x[1]),1);
 const ch=sv('svg',{viewBox:'0 0 280 130',class:'bars',role:'img','aria-label':'Pengeluaran 7 hari terakhir'});
 wk.forEach(([d,v],i)=>{const hh=v/mx*90,x=i*40+6;ch.append(sv('rect',{x,y:100-hh,width:28,height:Math.max(hh,3),rx:7,fill:i===6?'var(--acc)':'var(--pri)'}),sv('text',{x:x+14,y:120,'text-anchor':'middle','font-size':10,fill:'var(--mute)'},document.createTextNode(DAY[new Date(d+'T00:00:00').getDay()])))});
 const w1=wk.reduce((s,x)=>s+x[1],0),w0=sum(S.tx.filter(t=>t.date<=dAgo(7)&&t.date>=dAgo(13)),'out'),tips=[];
 if(cats[0])tips.push('Pengeluaran terbesar bulan ini: '+cats[0][0]+', '+Math.round(cats[0][1]/exp*100)+'% dari total.');
 if(w0>0)tips.push(w1<=w0?'Minggu ini kamu lebih hemat '+Math.round((1-w1/w0)*100)+'% dibanding minggu lalu.':'Pengeluaran minggu ini naik '+Math.round((w1/w0-1)*100)+'% dibanding minggu lalu.');
 EXP.forEach(c=>{const l=S.bud[c],sp=sum(mt.filter(t=>t.cat===c),'out');if(l>0&&sp>l)tips.push('Anggaran '+c+' terlewati '+rp(sp-l)+'.');else if(l>0&&sp>=l*.8)tips.push('Anggaran '+c+' tinggal '+rp(l-sp)+'.')});
 const tk=S.tasks.filter(t=>!t.done).sort((a,b)=>(a.due||'9').localeCompare(b.due||'9')).slice(0,3);
 const rec=S.tx.filter(t=>t.date===T).slice().reverse().slice(0,5);
 return h('div',{},head('Halo, ini kondisi uangmu',fmtD(T)),hero,
  tips.length?h('ul',{class:'tips'},tips.slice(0,4).map(t=>h('li',{},t))):'',
  h('div',{class:'cols',style:'margin-top:1rem'},
   h('section',{class:'pn'},h('h2',{},'Pengeluaran per kategori'),cats.length?h('div',{class:'lg'},dn,h('ul',{},cats.map(([c,v])=>h('li',{},h('i',{class:'sw',style:'background:'+col(c)}),c,h('span',{},rp(v)))))):empty('Belum ada pengeluaran bulan ini.')),
   h('section',{class:'pn'},h('h2',{},'7 hari terakhir'),ch,h('p',{class:'mute sm'},'Total '+rp(w1)+' dalam seminggu.'))),
  h('h2',{},'Transaksi hari ini'),rec.length?rec.map(t=>txRow(t)):empty('Belum ada transaksi hari ini. Riwayat sebelumnya ada di menu Transaksi.'),

  h('section',{class:'pn',style:'margin-top:1rem'},
    h('h2',{},'Tugas terdekat'),

    tk.length
      ? tk.map(t=>h('div',{
          class:'li',
          style:'grid-template-columns:1fr auto'
        },
          h('span',{},t.t),
          h('small',{},
            t.due
              ? 'Tenggat '+fmtD(t.due)
              : 'Tanpa tenggat'
          )
        ))
      : empty('Belum ada tugas aktif. Tambahkan tugas melalui menu Tugas.')
  ));

};

V.transaksi=()=>{
 const q=h('input',{type:'search',placeholder:'Cari catatan atau kategori','aria-label':'Cari'}),ty=sel([['','Semua jenis'],['out','Pengeluaran'],['in','Pemasukan']]),mon=h('input',{type:'month',value:today().slice(0,7),'aria-label':'Bulan'}),list=h('div');
 const draw=()=>{const k=q.value.toLowerCase(),r=S.tx.filter(t=>t.date.startsWith(mon.value)&&(!ty.value||t.type===ty.value)&&(t.cat+' '+t.note).toLowerCase().includes(k)).sort((a,b)=>b.date.localeCompare(a.date)),g={};
  r.forEach(t=>(g[t.date]=g[t.date]||[]).push(t));
  list.replaceChildren(...(r.length?Object.keys(g).map(d=>h('section',{class:'day'},h('div',{class:'dh'},h('b',{},fmtD(d)),h('span',{},'Keluar '+rp(sum(g[d],'out')))),g[d].map(t=>txRow(t,id=>{del('tx',id);draw()})))):[empty('Tidak ada transaksi yang cocok.')]))};
 [q,ty,mon].forEach(e=>e.addEventListener('input',draw));draw();
 return h('div',{},head('Transaksi','Semua pemasukan dan pengeluaranmu.',h('button',{class:'btn',onclick:openAdd},'Catat baru')),h('div',{class:'row filt'},q,ty,mon),list)};

V.anggaran=()=>{
 const mt=S.tx.filter(t=>t.date.startsWith(today().slice(0,7)));
 return h('div',{},head('Anggaran','Batas pengeluaran tiap kategori bulan ini. Kosongkan kalau tidak mau dibatasi.'),
  h('div',{class:'cols'},EXP.map(c=>{const sp=sum(mt.filter(t=>t.cat===c),'out'),lim=S.bud[c]||0,p=lim?sp/lim:0;
   const i=h('input',{type:'number',min:'0',max:'1000000000',step:'1000',value:lim||'',placeholder:'0'});
   i.addEventListener('change',()=>{S.bud[c]=num(i.value);save();route();toast('Batas '+c+' disimpan.')});
   return h('section',{class:'pn'},h('div',{class:'li2'},h('b',{},c),h('span',{class:p>=1?'out':'mute'},lim?(p>=1?'Lebih '+rp(sp-lim):p>=.8?'Hampir habis, sisa '+rp(lim-sp):'Sisa '+rp(lim-sp)):'Terpakai '+rp(sp))),bar(sp,lim,col(c)),h('div',{style:'margin-top:.8rem'},fld('Batas (Rp)',i)))})))};

V.tabungan=()=>{
 const n=h('input',{required:'',maxlength:'50',placeholder:'mis. laptop baru'}),t=h('input',{type:'number',min:'1',max:'1000000000',required:'',placeholder:'8000000'});
 const form=h('form',{class:'row pn',onsubmit:e=>{e.preventDefault();if(!num(t.value)||!n.value.trim())return;S.goals.push({id:uid(),name:str(n.value.trim(),50),target:num(t.value),saved:0});save();route()}},fld('Nama target',n),fld('Jumlah target (Rp)',t),h('button',{type:'submit',class:'btn'},'Tambah target'));
 return h('div',{},head('Tabungan','Target yang mau kamu kejar. Setoran di sini tidak mengurangi saldo, jadi catat juga sebagai pengeluaran kalau uangnya dipisah.'),form,h('div',{class:'cols',style:'margin-top:1rem'},
  S.goals.length?S.goals.map(g=>{const a=h('input',{type:'number',min:'1',max:'1000000000',placeholder:'Setor (Rp)','aria-label':'Setor ke '+g.name}),p=g.target?Math.min(100,Math.round(g.saved/g.target*100)):0;
   return h('section',{class:'pn'},h('div',{class:'li2'},h('b',{},g.name),h('span',{class:'pct'},p+'%')),bar(g.saved,g.target),h('p',{class:'mute sm',style:'margin-top:.5rem'},rp(g.saved)+' dari '+rp(g.target)+(g.saved<g.target?'. Kurang '+rp(g.target-g.saved)+'.':'. Tercapai!')),
    h('div',{class:'inl'},a,h('button',{class:'btn ghost',onclick:()=>{const v=num(a.value);if(!v)return;g.saved=Math.min(1e12,g.saved+v);save();route()}},'Setor'),h('button',{class:'lk','aria-label':'Hapus target '+g.name,onclick:()=>{if(confirm('Hapus target ini?')){del('goals',g.id);route()}}},'Hapus')))}):[empty('Belum ada target. Mulai dari yang kecil, misalnya dana darurat satu bulan.')]))};

V.utang=()=>{
 const w=h('input',{required:'',maxlength:'50',placeholder:'Nama teman'}),a=h('input',{type:'number',min:'1',max:'1000000000',required:'',placeholder:'50000'}),d=sel([['owe','Aku yang berutang'],['lent','Dia yang berutang']]),nt=h('input',{maxlength:'80',placeholder:'mis. patungan fotokopi'});
 const form=h('form',{class:'row pn',onsubmit:e=>{e.preventDefault();if(!num(a.value)||!w.value.trim())return;S.debts.push({id:uid(),who:str(w.value.trim(),50),amt:num(a.value),dir:d.value,note:str(nt.value),done:false});save();route()}},fld('Siapa',w),fld('Nominal (Rp)',a),fld('Posisi',d),fld('Catatan',nt),h('button',{type:'submit',class:'btn'},'Catat'));
 const op=S.debts.filter(x=>!x.done),owe=op.filter(x=>x.dir==='owe').reduce((s,x)=>s+x.amt,0),lent=op.filter(x=>x.dir==='lent').reduce((s,x)=>s+x.amt,0);
 const tot=h('input',{type:'number',min:'1',placeholder:'Total tagihan'}),ppl=h('input',{type:'number',min:'2',max:'100',value:'4','aria-label':'Jumlah orang'}),res=h('p',{class:'big',style:'font-size:1.8rem;margin:.6rem 0 0'},rp(0));
 const calc=()=>{res.textContent=rp(Math.ceil(num(tot.value)/Math.max(2,num(ppl.value)||2)))+' per orang'};[tot,ppl].forEach(e=>e.addEventListener('input',calc));
 return h('div',{},head('Utang dan patungan','Catat siapa berutang ke siapa, biar pertemanan tetap aman.'),form,
  h('div',{class:'cols',style:'margin:1rem 0'},h('section',{class:'pn'},h('p',{class:'mute sm'},'Yang harus kamu bayar'),h('p',{class:'pct out'},rp(owe))),h('section',{class:'pn'},h('p',{class:'mute sm'},'Yang harus dibayar ke kamu'),h('p',{class:'pct in'},rp(lent)))),
  S.debts.length?S.debts.map(x=>h('div',{class:'li'},h('i',{class:'dot',style:'background:'+(x.dir==='owe'?'#d9482b':'#12805f')},x.who[0]),h('div',{class:x.done?'done':''},x.who+(x.dir==='owe'?' (kamu berutang)':' (berutang ke kamu)'),h('small',{},x.note||'Tanpa catatan')),h('span',{class:'amt '+(x.dir==='owe'?'out':'in')},rp(x.amt)),
   h('span',{},h('button',{class:'lk',onclick:()=>{x.done=!x.done;save();route()}},x.done?'Buka lagi':'Lunas'),h('button',{class:'lk','aria-label':'Hapus catatan '+x.who,onclick:()=>{if(confirm('Hapus catatan ini?')){del('debts',x.id);route()}}},'Hapus')))):empty('Belum ada catatan utang.'),
  h('h2',{},'Kalkulator patungan'),h('section',{class:'pn'},h('div',{class:'row'},fld('Total (Rp)',tot),fld('Jumlah orang',ppl)),res))};

V.tugas=()=>{
 const t=h('input',{required:'',maxlength:'100',placeholder:'mis. laporan praktikum'}),d=h('input',{type:'date'});
 const form=h('form',{class:'row pn',onsubmit:e=>{e.preventDefault();if(!t.value.trim())return;S.tasks.push({id:uid(),t:str(t.value.trim(),100),due:dt(d.value),done:false});save();route()}},fld('Tugas',t),fld('Tenggat',d),h('button',{type:'submit',class:'btn'},'Tambah tugas'));
 const r=S.tasks.slice().sort((a,b)=>(a.done-b.done)||(a.due||'9').localeCompare(b.due||'9'));
 return h('div',{},head('Tugas','Tenggat kuliah yang jangan sampai kelewat.'),form,h('div',{style:'margin-top:1rem'},r.length?r.map(x=>h('div',{class:'li',style:'grid-template-columns:auto 1fr auto'},
  h('input',{type:'checkbox','aria-label':'Selesai: '+x.t,style:'width:1.3rem;height:1.3rem',...(x.done?{checked:''}:{}),onchange:()=>{x.done=!x.done;save();route()}}),
  h('div',{class:x.done?'done':''},x.t,h('small',{},x.due?(!x.done&&x.due<today()?'Terlambat, tenggat ':'Tenggat ')+fmtD(x.due):'Tanpa tenggat')),
  h('button',{class:'lk','aria-label':'Hapus tugas '+x.t,onclick:()=>{del('tasks',x.id);route()}},'Hapus'))):empty('Belum ada tugas.')))};

V.data=()=>{
 const nx=h('input',{type:'date',value:S.next});nx.addEventListener('change',()=>{S.next=dt(nx.value);save();toast('Tanggal kiriman disimpan.')});
 const fi=h('input',{type:'file',accept:'.json,application/json'});
 fi.addEventListener('change',()=>{const f=fi.files[0];if(!f)return;if(f.size>2e6)return toast('File terlalu besar.');
  const r=new FileReader();r.onload=()=>{try{const parsed=JSON.parse(r.result);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Format tidak sesuai');const n=clean(parsed);if(confirm('Ganti semua data sekarang dengan isi cadangan ini?')){S=n;const ok=save();route();if(ok)toast('Cadangan berhasil dipulihkan.')}}catch(e){toast('File bukan cadangan Kantong yang valid atau isinya rusak.')}};r.onerror=()=>toast('File cadangan tidak berhasil dibaca.');r.readAsText(f)});
 const syncText=window.KANTONG_CLOUD_READY
  ? 'Data akun tersimpan di cloud dan disinkronkan ke perangkat lain saat terhubung internet. File MySpace disimpan privat.'
  : 'Sinkronisasi cloud belum siap. Perubahan tersimpan pada perangkat ini dan akan dicoba dikirim saat koneksi kembali. Unduh cadangan secara berkala.';
 return h('div',{},head('Data','Akun, sinkronisasi, pencadangan, dan privasi.'),
  h('section',{class:'pn'},h('h2',{},'Tanggal kiriman berikutnya'),h('p',{class:'mute sm'},'Dipakai untuk menghitung jatah harian di Beranda.'),fld('Tanggal',nx)),
  h('section',{class:'pn',style:'margin-top:1rem'},h('h2',{},'Sinkronisasi dan cadangan'),h('p',{class:'mute sm'},syncText+' File cadangan JSON tetap penting karena paket gratis tidak menyediakan backup database otomatis harian. Simpan hasil unduhan di tempat yang aman.'),
   h('div',{class:'inl'},h('button',{class:'btn',onclick:()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(S,null,1)],{type:'application/json'})),a=h('a',{href:url,download:'kantong-cadangan-'+today()+'.json'});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}},'Unduh cadangan')),
   h('div',{style:'margin-top:1rem'},fld('Pulihkan dari file cadangan',fi))),
  h('section',{class:'pn',style:'margin-top:1rem'},h('h2',{},'Hapus semua data'),h('p',{class:'mute sm'},'Peringatan: file cadangan berisi catatan keuangan dalam bentuk yang dapat dibaca. Jangan bagikan kepada orang lain.'),h('button',{class:'btn ghost',onclick:()=>{if(confirm('Hapus semua data? Ini tidak bisa dibatalkan.')){S=blank();save();route()}}},'Hapus semua data')))};

const NAV=[['beranda','Beranda'],['transaksi','Transaksi'],['anggaran','Anggaran'],['tabungan','Tabungan'],['utang','Utang'],['tugas','Tugas'],['myspace','MySpace'],['data','Data']];
function route(){
 if(typeof window.cleanupMySpace==='function'){window.cleanupMySpace();window.cleanupMySpace=null;}
 const k=Object.prototype.hasOwnProperty.call(V,location.hash.slice(1))?location.hash.slice(1):'beranda';
 $('#nav').replaceChildren(...NAV.map(([id,l])=>h('a',{href:'#'+id,'aria-current':id===k?'page':'false'},ic(IC[id]),l)));
 $('#main').replaceChildren(V[k]());
}
let cloudChannel=null,activeCloudUser=null,loadingCloudUser=null;
async function connectAccount(session){
 const user=session&&session.user?session.user:null;
 if(!user){
  window.KANTONG_CLOUD_READY=false;
  activeCloudUser=null;
  loadingCloudUser=null;
  if(cloudChannel&&window.KantongCloud&&window.KantongCloud.client){
   window.KantongCloud.client.removeChannel(cloudChannel).catch(()=>{});
   cloudChannel=null;
  }
  S=blank();
  route();
  return;
 }
 if(activeCloudUser===user.id&&window.KANTONG_CLOUD_READY)return;
 if(loadingCloudUser===user.id)return;
 loadingCloudUser=user.id;
 window.KANTONG_CLOUD_READY=false;
 S=blank();
 route();
 try{
  const initial=await window.KantongCloud.loadFinance(S);
  if(!window.KANTONG_CURRENT_USER||window.KANTONG_CURRENT_USER.id!==user.id)return;
  S=clean(initial);
  activeCloudUser=user.id;
  window.KANTONG_CLOUD_READY=true;
  const authScreen=document.getElementById('auth-screen');
  if(authScreen)authScreen.hidden=true;
  document.body.classList.remove('auth-booting','auth-signed-out');
  if(cloudChannel)await window.KantongCloud.client.removeChannel(cloudChannel);
  cloudChannel=window.KantongCloud.subscribeFinance((data)=>{
   if(!window.KANTONG_CURRENT_USER||window.KANTONG_CURRENT_USER.id!==user.id)return;
   const incoming=clean(data);
   if(JSON.stringify(incoming)===JSON.stringify(S))return;
   S=incoming;
   try{localStorage.setItem('kantong.v1.user.'+user.id,JSON.stringify(S))}catch(e){console.warn('Local cache unavailable',e)}
   route();
   toast('Data dari perangkat lain berhasil disinkronkan.');
  });
  route();
 }catch(error){
  console.error('Kantong initial sync:',error);
  try{
   const cached=localStorage.getItem('kantong.v1.user.'+user.id);
   if(cached){
    S=clean(JSON.parse(cached));
    activeCloudUser=user.id;
    const authScreen=document.getElementById('auth-screen');
    if(authScreen)authScreen.hidden=true;
    document.body.classList.remove('auth-booting','auth-signed-out');
    route();
    toast('Koneksi cloud belum tersedia. Menampilkan salinan lokal; perubahan akan dicoba sinkron saat internet kembali.');
   }else{
    const authScreen=document.getElementById('auth-screen');
    if(authScreen){
     authScreen.hidden=false;
     const card=h('section',{class:'auth-card'},h('h1',{},'Data belum bisa dimuat'),h('p',{},error.message||'Periksa koneksi dan konfigurasi Supabase.'),h('button',{class:'btn',onclick:()=>connectAccount({user})},'Coba lagi'));
     authScreen.replaceChildren(card);
    }
   }
  }catch(cacheError){
   toast('Data cloud belum dapat dimuat. Periksa koneksi, lalu muat ulang halaman.');
  }
 }finally{
  if(loadingCloudUser===user.id)loadingCloudUser=null;
 }
}
window.addEventListener('kantong-auth-change',event=>connectAccount(event.detail&&event.detail.session));
window.addEventListener('kantong-cloud-error',event=>{
 const message=event.detail&&event.detail.message;
 toast('Sinkronisasi belum berhasil'+(message?': '+message:'')+'. Data lokal masih tersedia.');
});
$('#fab').append(ic(IC.plus),h('span',{},'Catat'));$('#fab').addEventListener('click',openAdd);
$('#dq').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close()});
addEventListener('hashchange',()=>{route();scrollTo(0,0)});
route();


window.addEventListener('online',()=>{
 const user=window.KANTONG_CURRENT_USER;
 if(user&&!window.KANTONG_CLOUD_READY&&!loadingCloudUser)connectAccount({user});
});
