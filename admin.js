import { firebaseConfig } from './firebase-config.js';
let initializeApp,getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut;
let getFirestore,doc,collection,getDoc,onSnapshot,updateDoc,serverTimestamp;
const root=document.getElementById('adminApp');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let auth,db,currentUser,unsubscribe=null,users=[],filter='pending',working=false;
function login(message=''){
 root.innerHTML=`<div class="panel login"><h2>My Library 관리자</h2><p class="help">승인된 관리자 계정만 사용할 수 있습니다.</p><form id="adminLogin"><label>이메일<input type="email" name="email" autocomplete="username" required></label><label>비밀번호<input type="password" name="password" autocomplete="current-password" required></label><button class="button primary" type="submit">로그인</button></form><div class="message">${esc(message)}</div><p><a href="./index.html">일반 사용자 페이지</a></p></div>`;
}
function denied(message){root.innerHTML=`<div class="panel login"><h2>접근 권한 없음</h2><p>${esc(message)}</p><button class="button" id="adminLogout">로그아웃</button> <a href="./index.html">사용자 페이지</a></div>`;}
function stats(){return {all:users.length,pending:users.filter(x=>x.status==='pending').length,approved:users.filter(x=>x.status==='approved').length};}
function page(){
 const s=stats();const names={pending:'승인 대기',approved:'승인됨',rejected:'거절',suspended:'이용 정지'};
 const rows=users.filter(x=>filter==='all'||x.status===filter);
 root.innerHTML=`<header class="header"><div><small>MY LIBRARY / ADMINISTRATION</small><h1>회원 관리</h1><small>계정별 작품·컬렉션 내용은 관리자 화면에 표시하지 않습니다.</small></div><nav class="nav"><a href="./index.html">라이브러리</a><button id="adminLogout">로그아웃</button></nav></header>
 <section class="panel"><div class="stats"><div class="stat"><strong>${s.all}</strong><span>전체 신청 계정</span></div><div class="stat"><strong>${s.pending}</strong><span>승인 대기</span></div><div class="stat"><strong>${s.approved}</strong><span>승인 완료</span></div></div>
 <div class="filters">${['pending','approved','rejected','suspended','all'].map(k=>`<button data-filter="${k}" class="${filter===k?'active':''}">${k==='all'?'전체':names[k]}</button>`).join('')}</div>
 <div id="adminStatus" class="help"></div>
 ${rows.length?rows.map(x=>`<article class="member"><div><div class="member-title">${esc(x.nickname||'이름 없음')} <span class="tag ${esc(x.status)}">${esc(names[x.status]||x.status)}</span> ${x.role==='admin'?'<span class="tag approved">관리자</span>':''}</div><div class="sub">${esc(x.email||'-')}</div><div class="sub">가입: ${x.createdAt?.toDate?.().toLocaleString('ko-KR')||'-'}</div></div><div class="actions">${x.uid===currentUser?.uid?'<span class="help">본인 계정</span>':[
 x.status!=='approved'?`<button class="button primary" data-uid="${esc(x.uid)}" data-status="approved">승인 / 재승인</button>`:'',
 x.status==='pending'?`<button class="button danger" data-uid="${esc(x.uid)}" data-status="rejected">거절</button>`:'',
 x.status==='approved'?`<button class="button danger" data-uid="${esc(x.uid)}" data-status="suspended">이용 정지</button>`:'',
 x.status==='suspended'?`<button class="button danger" data-uid="${esc(x.uid)}" data-status="rejected">거절 처리</button>`:''
 ].join('')}</div></article>`).join(''):'<div class="empty">해당하는 계정이 없습니다.</div>'}</section>
 <p class="help">승인 변경은 Firestore 접근 규칙에 즉시 반영됩니다. 이미 열려 있는 라이브러리 화면도 계정 상태를 다시 확인합니다.</p>`;
}
async function verifyAdmin(user){
 const result=await getDoc(doc(db,'users',user.uid));
 return user.emailVerified&&result.exists()&&result.data().role==='admin'&&result.data().status==='approved';
}
root.addEventListener('submit',async e=>{
 if(e.target.id!=='adminLogin')return;e.preventDefault();
 const data=new FormData(e.target);const button=e.target.querySelector('button');button.disabled=true;
 try{await signInWithEmailAndPassword(auth,String(data.get('email')).trim(),String(data.get('password')));}
 catch(err){login(err?.code==='auth/invalid-credential'?'이메일이나 비밀번호가 올바르지 않습니다.':String(err.message||err));}
 finally{if(button.isConnected)button.disabled=false;}
});
root.addEventListener('click',async e=>{
 if(e.target.closest('#adminLogout')){await signOut(auth);location.reload();return;}
 const key=e.target.closest('[data-filter]');if(key){filter=key.dataset.filter;page();return;}
 const button=e.target.closest('[data-uid][data-status]');if(!button||working)return;
 const uid=button.dataset.uid,status=button.dataset.status;
 if(uid===currentUser?.uid)return;
 const label={approved:'승인',rejected:'거절',suspended:'이용 정지'}[status]||status;
 if(!confirm(`선택한 계정을 '${label}' 상태로 변경할까요?`))return;
 working=true;button.disabled=true;
 try{
   const patch={status,updatedAt:serverTimestamp()};
   if(status==='approved')patch.approvedAt=serverTimestamp();
   await updateDoc(doc(db,'users',uid),patch);
 }catch(err){alert('변경 실패: '+String(err?.message||err));}
 finally{working=false;button.disabled=false;}
});
if(!firebaseConfig.apiKey||firebaseConfig.apiKey.includes('REPLACE_'))denied('firebase-config.js의 Firebase 프로젝트 설정을 입력하세요.');
else {
 try{
  const [appMod,authMod,firestoreMod]=await Promise.all([
   import('https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js'),
   import('https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js'),
   import('https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js')
  ]);
  ({initializeApp}=appMod);
  ({getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut}=authMod);
  ({getFirestore,doc,collection,getDoc,onSnapshot,updateDoc,serverTimestamp}=firestoreMod);
  const firebase=initializeApp(firebaseConfig);auth=getAuth(firebase);db=getFirestore(firebase);
  onAuthStateChanged(auth,async user=>{
   if(unsubscribe){unsubscribe();unsubscribe=null;}
   if(!user){currentUser=null;login();return;}
   currentUser=user;
   try{
    if(!await verifyAdmin(user)){denied('현재 계정은 관리자 권한이 없거나 이메일 인증이 완료되지 않았습니다.');return;}
    root.innerHTML='<div class="panel">회원 목록을 불러오는 중입니다.</div>';
    unsubscribe=onSnapshot(collection(db,'users'),snapshot=>{
      users=snapshot.docs.map(d=>d.data());page();
    },err=>{denied('회원 목록을 불러올 수 없습니다: '+String(err.message||err));});
   }catch(e){denied('관리자 권한 확인 실패: '+String(e.message||e));}
  });
 }catch(err){denied('Firebase 연결 초기화 실패: '+String(err.message||err));}
}
