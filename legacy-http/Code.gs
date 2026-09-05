/**
 * 旷野公司 · 15 天  —  Google Apps Script 后端
 * 部署：Sheet → 扩展功能 → Apps Script → 贴上这个 → 部署 → 网页应用程式
 *      执行身分「我」，存取权限「任何人」
 */
var PIN='4717', N=6, DAYS=15, DAY_MS=60000;
var START_CASH=10, WORK=5, GAIN=10, MAX=4, LEVEL_PTS=10;
var BUILD={1:10,2:20,3:30};
var FAMINE=[6,7], GRACE=12, DEBTDAY=13;
var LV_NAME={1:'帐篷',2:'木屋',3:'石屋',4:'城堡'};
var LV_EMO={1:'⛺',2:'🛖',3:'🏠',4:'🏰'};
var EVENTS={
  6:{icon:'🌵',title:'饥荒',text:'市场关闭两天。没得赚的时候，试探最好听。'},
  8:{icon:'🌾',title:'市场重开',text:'饥荒过去了。'},
  12:{icon:'🕊️',title:'恩典',text:'每间公司白白得到 1 张 📖。不是你赚的。'},
  13:{icon:'💸',title:'还债日',text:'每一个 🪝，拆掉一层楼。钱买不回来。'},
  15:{icon:'🏁',title:'第十五天',text:'结算。'}
};

function P_(){ return PropertiesService.getScriptProperties(); }
function fresh_(){
  var co=[];
  for(var i=0;i<N;i++) co.push({name:'第 '+(i+1)+' 公司',cash:START_CASH,word:0,debt:0,level:1,dice:0});
  return {start:null,pausedAt:null,paused:0,grace:false,collected:false,co:co,hist:[]};
}
function load_(){
  var raw=P_().getProperty('S');
  if(!raw) { var s=fresh_(); save_(s); return s; }
  try { return JSON.parse(raw); } catch(e){ var f=fresh_(); save_(f); return f; }
}
function save_(s){ P_().setProperty('S', JSON.stringify(s)); }

function elapsed_(s){
  if(!s.start) return 0;
  var now = s.pausedAt ? s.pausedAt : Date.now();
  return now - s.start - s.paused;
}
function day_(s){
  if(!s.start) return 0;
  return Math.min(DAYS, Math.floor(elapsed_(s)/DAY_MS)+1);
}
function inFamine_(d){ return FAMINE.indexOf(d)>=0; }
function push_(s){
  s.hist.push(JSON.stringify({co:s.co,grace:s.grace,collected:s.collected}));
  while(s.hist.length>8) s.hist.shift();
}
/** 有真的改到东西才回 true。
 *  第 13 天之后每次都收，所以最后三天签了一样要拆楼。 */
function auto_(s){
  var d=day_(s), ch=false;
  if(d>=GRACE && !s.grace){ for(var i=0;i<N;i++) s.co[i].word++; s.grace=true; ch=true; }
  if(d>=DEBTDAY){
    for(var j=0;j<N;j++){
      var c=s.co[j];
      while(c.debt>0 && c.level>1){ c.debt--; c.level--; ch=true; }
      if(c.debt!==0){ c.debt=0; ch=true; }
    }
    if(!s.collected){ s.collected=true; ch=true; }
  }
  return ch;
}
function state_(s){
  var d=day_(s), rows=[];
  for(var i=0;i<N;i++){
    var c=s.co[i];
    rows.push({i:i,name:c.name,cash:c.cash,word:c.word,debt:c.debt,level:c.level,
               lv:LV_NAME[c.level],emo:LV_EMO[c.level],score:(c.level-1)*LEVEL_PTS,
               dice:c.dice,cost:BUILD[c.level]||0});
  }
  return {rows:rows,day:d,days:DAYS,started:!!s.start,running:!!s.start&&!s.pausedAt,
          secs: s.start ? Math.max(0, Math.round((DAYS*DAY_MS-elapsed_(s))/1000)) : DAYS*DAY_MS/1000,
          event:EVENTS[d]||null, famine:inFamine_(d), work:WORK, gain:GAIN};
}
function act_(s,d){
  var a=String(d.action||''), ti=Number(d.team);
  if(!(ti>=0&&ti<N)) return {ok:false,error:'公司不对'};
  var c=s.co[ti], dy=day_(s);
  if(a==='rename'){
    var nm=String(d.name||'').replace(/^\s+|\s+$/g,'').substring(0,12);
    if(!nm) return {ok:false,error:'名字不可以空白'};
    push_(s); c.name=nm; return {ok:true,msg:'改好了'};
  }
  if(a==='work'){
    if(inFamine_(dy)) return {ok:false,error:'🌵 饥荒中，市场关着（第 8 天再开）'};
    push_(s); c.cash+=WORK; c.dice=0; return {ok:true,msg:c.name+' +'+WORK+' 💰'};
  }
  if(a==='altar'){ push_(s); c.word++; c.dice=0; return {ok:true,msg:c.name+' 得到 1 张 📖'}; }
  if(a==='build'){
    if(c.level>=MAX) return {ok:false,error:c.name+' 已经是 🏰'};
    var cost=BUILD[c.level];
    if(c.cash<cost) return {ok:false,error:'要 '+cost+' 💰，'+c.name+' 只有 '+c.cash};
    push_(s); c.cash-=cost; c.level++; c.dice=0;
    return {ok:true,msg:c.name+' 盖成 '+LV_EMO[c.level]+' '+LV_NAME[c.level]};
  }
  if(a==='word'){
    if(c.word<=0) return {ok:false,error:c.name+' 没有 📖，只能自己撑'};
    push_(s); c.word--; c.dice=0; return {ok:true,msg:c.name+' 念出神的话，试探官走了 🛡️'};
  }
  if(a==='will'){
    push_(s);
    var r=Math.floor(Math.random()*6)+1; c.dice=r;
    if(r<=2) return {ok:true,msg:'🎲 '+r+' — 撑住了！'};
    c.cash+=GAIN; c.debt++;
    if(dy>=DEBTDAY){
      var lost=0;
      while(c.debt>0 && c.level>1){ c.debt--; c.level--; lost++; }
      c.debt=0;
      return {ok:true,msg:'🎲 '+r+' — 撑不住，签了 → +'+GAIN+' 💰，'+
        (lost ? ('马上拆掉一层 → '+LV_EMO[c.level]+' '+LV_NAME[c.level])
              : '已经是 ⛺，没得拆了')};
    }
    return {ok:true,msg:'🎲 '+r+' — 撑不住，签了 → +'+GAIN+' 💰，欠 1 个 🪝'};
  }
  return {ok:false,error:'动作不明'};
}
function json_(o){
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
function doGet(e){
  var p=(e&&e.parameter)||{}, a=p.action||'';
  if(!a){
    var s0=load_();
    if(auto_(s0)){          // 只有恩典／还债真的发生才写回，而且要拿锁，
      var lk=LockService.getScriptLock(); lk.waitLock(8000);   // 不然会盖掉手机同时送来的动作
      try{ s0=load_(); auto_(s0); save_(s0); } finally { lk.releaseLock(); }
    }
    return json_(state_(s0));
  }
  if(p.pin!==PIN) return json_({ok:false,error:'PIN 不对'});
  if(a==='ping') return json_({ok:true});        // 只验密码，不动任何东西
  if(a==='selftest') return json_(selfTest_());
  var lock=LockService.getScriptLock(); lock.waitLock(8000);
  try{
    var s=load_();
    if(a==='reset') s=fresh_();
    else if(a==='start'){
      if(!s.start) s.start=Date.now();
      else if(s.pausedAt){ s.paused += Date.now()-s.pausedAt; s.pausedAt=null; }
    }
    else if(a==='pause'){ if(s.start&&!s.pausedAt) s.pausedAt=Date.now(); }
    else if(a==='skip'){ if(s.start) s.start-=DAY_MS; }
    else if(a==='undo'){
      if(s.hist.length){ var h=JSON.parse(s.hist.pop()); s.co=h.co; s.grace=h.grace; s.collected=h.collected; }
    }
    else return json_({ok:false,error:'?'});
    save_(s); return json_({ok:true});
  } finally { lock.releaseLock(); }
}
function doPost(e){
  var d;
  try { d=JSON.parse(e.postData.contents); } catch(err){ return json_({ok:false,error:'bad json'}); }
  if(d.action==='rename' && String(d.pin)!==PIN) return json_({ok:false,error:'改名要主持人密码'});
  var lock=LockService.getScriptLock(); lock.waitLock(8000);
  try{
    var s=load_(); auto_(s);
    var r=act_(s,d); auto_(s); save_(s); return json_(r);
  } finally { lock.releaseLock(); }
}

/** 部署后打开  你的网址?action=selftest&pin=4717  确认规则都对 */
function selfTest_(){
  var out=[], ok=true;
  function ck(l,c,d){ out.push((c?'PASS  ':'FAIL  ')+l+(d!==undefined?('  -> '+d):'')); if(!c) ok=false; }
  var s=fresh_(); s.start=Date.now();
  ck('起手 10 💰 0 📖 ⛺', s.co[0].cash===10&&s.co[0].word===0&&s.co[0].level===1);
  act_(s,{action:'work',team:0});  ck('市场 +5', s.co[0].cash===15, s.co[0].cash);
  act_(s,{action:'altar',team:0}); ck('祭坛免费给 📖', s.co[0].word===1&&s.co[0].cash===15);
  act_(s,{action:'build',team:0}); ck('盖木屋花 10 → 10 分', s.co[0].level===2&&s.co[0].cash===5);
  ck('钱不够盖不了', act_(s,{action:'build',team:0}).ok===false);
  act_(s,{action:'word',team:0});  ck('念神的话不欠债', s.co[0].word===0&&s.co[0].debt===0);
  ck('没 📖 不能念', act_(s,{action:'word',team:1}).ok===false);
  var held=0,fell=0;
  for(var k=0;k<400;k++){
    var t=fresh_(); t.start=Date.now();
    var r=act_(t,{action:'will',team:0});
    if(r.msg.indexOf('撑住')>=0){ held++; if(t.co[0].debt!==0) ok=false; }
    else { fell++; if(t.co[0].debt!==1||t.co[0].cash!==20) ok=false; }
  }
  ck('自己撑约 1/3 会成功', held/400>0.24&&held/400<0.43, held+'/'+400);
  var f=fresh_(); f.start=Date.now()-5*DAY_MS;
  ck('第 6 天饥荒', day_(f)===6&&inFamine_(day_(f)), day_(f));
  ck('饥荒时市场关', act_(f,{action:'work',team:0}).ok===false);
  ck('饥荒时祭坛开', act_(f,{action:'altar',team:0}).ok===true);
  var g=fresh_(); g.start=Date.now()-11*DAY_MS; auto_(g);
  ck('第 12 天恩典 +1 📖', day_(g)===12&&g.co[0].word===1&&g.co[5].word===1);
  var b=fresh_(); b.start=Date.now();
  b.co[0].level=3; b.co[0].debt=2; b.co[0].cash=99;
  b.start=Date.now()-12*DAY_MS; auto_(b);
  ck('还债日拆两层', b.co[0].level===1&&b.co[0].debt===0, 'level='+b.co[0].level);
  ck('钱赎不回来', b.co[0].cash===99, b.co[0].cash);
  var z=fresh_(); z.start=Date.now()-12*DAY_MS; z.co[0].debt=3; auto_(z);
  ck('帐篷拆不了也不会负', z.co[0].level===1&&z.co[0].debt===0);
  var mark=0, tries=0;
  while(mark===0 && tries<200){
    tries++;
    var n=fresh_(); n.start=Date.now()-13*DAY_MS; auto_(n);   // 第 14 天
    n.co[0].level=3;
    var rr=act_(n,{action:'will',team:0});
    if(rr.msg.indexOf('撑不住')>=0) mark=n.co[0].level*10+n.co[0].debt;
  }
  ck('还债日之后签了马上拆一层', mark===20, 'level*10+debt='+mark);
  var n3=fresh_(); n3.start=Date.now()-13*DAY_MS; auto_(n3); n3.co[0].debt=2; auto_(n3);
  ck('还债日之后 \uD83E\uDE9D 不会留着', n3.co[0].debt===0&&n3.co[0].level===1);
  var q=fresh_(); q.start=Date.now();
  ck('平常日子不需要写回', auto_(q)===false);
  return {ok:ok, results:out};
}
