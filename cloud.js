/** My Library v3.1 account + Firestore adapter. Browser ESM; no build step required. */
import { firebaseConfig } from './firebase-config.js';
// SDK loads only after firebase-config.js is configured, so the setup screen also works offline.
let initializeApp,getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword;
let sendEmailVerification,sendPasswordResetEmail,signOut,onAuthStateChanged,reloadAuthUser;
let getFirestore,doc,collection,getDoc,getDocs,setDoc,updateDoc,serverTimestamp,runTransaction,writeBatch,onSnapshot;

const gate = document.querySelector('#authGate');
const $ = (selector) => gate.querySelector(selector);
const h = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('REPLACE_')
  && firebaseConfig.projectId && !firebaseConfig.projectId.includes('REPLACE_')
  && firebaseConfig.appId && !firebaseConfig.appId.includes('REPLACE_');
let auth, database, member, currentProfile, unsubscribeProfile = null, sessionEpoch = 0;
let loadedUid = null, busy = false, joiningNickname = '', lastDataRefresh = 0, registering = false;
const userDoc = uid => doc(database, 'users', uid);
const entityCol = (uid, group) => collection(database, 'users', uid, group);
const entityDoc = (uid, group, id) => doc(database, 'users', uid, group, id);
const dateStamp = () => new Date().toISOString();

function view(mode, title, subtitle='', note='') {
  document.body.classList.remove('cloud-ready');
  gate.hidden = false;
  gate.innerHTML = `<div class="account-card"><div class="account-logo">ML</div><h1>${h(title)}</h1><p>${h(subtitle)}</p>
    ${note ? `<div class="account-hint">${h(note)}</div>` : ''}
    ${mode === 'login' ? `<form id="loginForm"><label>이메일<input name="email" type="email" autocomplete="username" required maxlength="254" placeholder="email@example.com"></label><label>비밀번호<input name="password" type="password" autocomplete="current-password" required minlength="6"></label><button class="account-primary" type="submit">로그인</button></form><div class="account-actions"><button data-cloud-action="signup">회원가입</button><button data-cloud-action="reset">비밀번호 재설정</button></div>` : ''}
    ${mode === 'signup' ? `<form id="signupForm"><label>닉네임<input name="nickname" maxlength="30" required placeholder="화면에 표시할 이름"></label><label>이메일<input name="email" type="email" autocomplete="email" required maxlength="254" placeholder="email@example.com"></label><label>비밀번호<input name="password" type="password" autocomplete="new-password" required minlength="6" placeholder="6자 이상"></label><label>비밀번호 확인<input name="confirmPassword" type="password" autocomplete="new-password" required minlength="6"></label><button class="account-primary" type="submit">가입 신청</button></form><div class="account-actions"><button data-cloud-action="login">로그인으로 돌아가기</button></div>` : ''}
    ${mode === 'reset' ? `<form id="resetForm"><label>가입 이메일<input name="email" type="email" autocomplete="email" required placeholder="email@example.com"></label><button class="account-primary" type="submit">재설정 메일 요청</button></form><div class="account-actions"><button data-cloud-action="login">로그인으로 돌아가기</button></div>` : ''}
    ${mode === 'verify' ? `<div class="account-actions centered"><button class="account-primary" data-cloud-action="refresh">인증 완료 후 확인</button><button data-cloud-action="resend">인증 메일 다시 보내기</button><button data-cloud-action="logout">로그아웃</button></div>` : ''}
    ${['pending','rejected','suspended','error','missing'].includes(mode) ? `<div class="account-actions centered"><button class="account-primary" data-cloud-action="refresh">상태 다시 확인</button><button data-cloud-action="logout">로그아웃</button></div>` : ''}
    <div class="account-error" id="accountError" role="alert" aria-live="polite"></div>
    <p class="account-foot">승인된 회원만 개인 라이브러리를 사용할 수 있습니다.</p></div>`;
}
function errorMessage(e) {
  console.warn('My Library Firebase:', e);
  const c = String(e?.code || '');
  const dictionary = {
    'auth/email-already-in-use':'이미 가입된 이메일입니다.',
    'auth/invalid-email':'이메일 형식을 확인해 주세요.',
    'auth/weak-password':'비밀번호가 너무 짧거나 약합니다.',
    'auth/invalid-credential':'이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/too-many-requests':'요청이 많습니다. 잠시 후 다시 시도해 주세요.',
    'auth/network-request-failed':'네트워크 연결을 확인해 주세요.',
    'permission-denied':'접근 권한이 없습니다. Firestore 규칙과 가입 상태를 확인해 주세요.',
    'unavailable':'서버에 접속하지 못했습니다. 네트워크 상태를 확인해 주세요.'
  };
  return dictionary[c] || String(e?.message || '작업 중 오류가 발생했습니다.').slice(0,240);
}
function showError(message) { const node=$('#accountError'); if (node) node.textContent=message; }
async function guarded(task) {
  if (busy) return; busy = true;
  gate.querySelectorAll('button').forEach(b=>b.disabled=true);
  showError('');
  try { await task(); } catch(e) { showError(errorMessage(e)); }
  finally { busy = false; gate.querySelectorAll('button').forEach(b=>b.disabled=false); }
}
function safeId(id) {
  const value = String(id || '');
  if (!value || value === '.' || value === '..' || value.includes('/') || value.length > 256) throw Error('작품 ID가 올바르지 않습니다.');
  return value;
}
function jsonClean(value) { return JSON.parse(JSON.stringify(value)); }
function cloudApiFor(uid) {
  const ref = (group,id)=>entityDoc(uid,group,safeId(id));
  const read = async group => (await getDocs(entityCol(uid,group))).docs.map(x=>x.data());
  const commands = async operations => {
    // Each chunk is atomic. A long import across multiple chunks is not globally atomic.
    for(let start=0; start<operations.length; start+=250){
      const batch=writeBatch(database);
      for(const op of operations.slice(start,start+250)){
        if(op.type==='set')batch.set(ref(op.group,op.id), jsonClean(op.data));
        else batch.delete(ref(op.group,op.id));
      }
      await batch.commit();
    }
  };
  return {
    load: async () => {
      const [items, collections, trash] = await Promise.all([read('items'),read('collections'),read('trash')]);
      return {items,collections,trash};
    },
    saveItem: async (item, expectedUpdatedAt) => {
      const target=ref('items',item.id);
      await runTransaction(database,async transaction=>{
        const before=await transaction.get(target);
        if(before.exists() && before.data().updatedAt !== expectedUpdatedAt){
          throw Error('다른 기기에서 수정된 작품입니다. JSON 백업 후 새로고침하여 변경 사항을 확인하세요.');
        }
        if(!before.exists() && expectedUpdatedAt !== null){
          throw Error('다른 기기에서 삭제된 작품입니다. 새로고침 후 다시 확인하세요.');
        }
        transaction.set(target,jsonClean(item));
      });
    },
    saveItems: async items => commands(items.map(item=>({type:'set',group:'items',id:item.id,data:item}))),
    moveToTrash: async items => {
      const when=dateStamp();
      await commands(items.flatMap(item=>[
        {type:'set',group:'trash',id:item.id,data:{id:item.id,item,deletedAt:when}},
        {type:'delete',group:'items',id:item.id}
      ]));
      return when;
    },
    restoreTrash: async rec => commands([
      {type:'set',group:'items',id:rec.id,data:rec.item},
      {type:'delete',group:'trash',id:rec.id}
    ]),
    replaceTrash: async (before,after) => {
      const keep=new Map(after.map(x=>[x.id,x]));
      await commands([
        ...before.filter(x=>!keep.has(x.id)).map(x=>({type:'delete',group:'trash',id:x.id})),
        ...after.map(x=>({type:'set',group:'trash',id:x.id,data:x}))
      ]);
    },
    saveCollections: async (before,after) => {
      const keep=new Map(after.map(x=>[x.id,x]));
      await commands([
        ...before.filter(x=>!keep.has(x.id)).map(x=>({type:'delete',group:'collections',id:x.id})),
        ...after.map(x=>({type:'set',group:'collections',id:x.id,data:x}))
      ]);
    },
    replaceAll: async (items,collections) => {
      const existing=await Promise.all([read('items'),read('collections')]);
      const nextItems=new Map(items.map(x=>[x.id,x]));
      const nextCollections=new Map(collections.map(x=>[x.id,x]));
      await commands([
        ...existing[0].filter(x=>!nextItems.has(x.id)).map(x=>({type:'delete',group:'items',id:x.id})),
        ...existing[1].filter(x=>!nextCollections.has(x.id)).map(x=>({type:'delete',group:'collections',id:x.id})),
        ...items.map(x=>({type:'set',group:'items',id:x.id,data:x})),
        ...collections.map(x=>({type:'set',group:'collections',id:x.id,data:x}))
      ]);
    }
  };
}
async function ensureProfile(user) {
  const target=userDoc(user.uid), found=await getDoc(target);
  if(found.exists()) return found.data();
  // Handles account creation where the Auth step succeeded but the profile write did not.
  const nickname=(joiningNickname || user.email?.split('@')[0] || '회원').slice(0,30);
  const initial={uid:user.uid,email:user.email,nickname,role:'member',status:'pending',createdAt:serverTimestamp()};
  await setDoc(target, initial);
  return {...initial,createdAt:new Date()};
}
async function refreshSession() {
  const epoch=++sessionEpoch;
  const user=auth.currentUser;
  if(unsubscribeProfile){unsubscribeProfile();unsubscribeProfile=null;}
  if(!user){loadedUid=null;member=null;view('login','My Library','내 콘텐츠를 계정별로 관리하세요.');return;}
  member=user;
  view('loading','계정 확인 중','가입 상태와 데이터 접근 권한을 확인하고 있습니다.');
  try {
    await reloadAuthUser(user);
    const profile=await ensureProfile(user);
    if(epoch!==sessionEpoch || !auth.currentUser || auth.currentUser.uid!==user.uid)return;
    currentProfile=profile;
    if(!user.emailVerified){view('verify','이메일 인증 필요',`${user.email} 주소로 전송된 인증 메일을 확인하세요.`);}
    else if(profile.status!=='approved'){
      const states={pending:['가입 승인 대기','관리자의 승인이 완료되면 이용할 수 있습니다.'],rejected:['가입 신청 거절','관리자에게 문의해 주세요.'],suspended:['이용이 정지된 계정','관리자에게 문의해 주세요.']};
      const [title,sub]=states[profile.status]||['승인 상태 확인 필요','관리자에게 문의해 주세요.'];
      view(profile.status,title,sub);
    } else {
      const api=cloudApiFor(user.uid);
      const data=await api.load();
      if(epoch!==sessionEpoch)return;
      await window.LibraryBridge.start({uid:user.uid,email:user.email,role:profile.role,nickname:profile.nickname,api,data});
      loadedUid=user.uid;
      gate.hidden=true;
      document.body.classList.add('cloud-ready');
      lastDataRefresh=Date.now();
    }
    if(!user.emailVerified || profile.status!=='approved') loadedUid=null;
    // Live approval and suspension checks; values are enforced by security rules too.
    unsubscribeProfile=onSnapshot(userDoc(user.uid), snap=>{
      if(!snap.exists()||!auth.currentUser||auth.currentUser.uid!==user.uid)return;
      const next=snap.data();
      const previous=currentProfile;
      currentProfile=next;
      if(previous && next.status!==previous.status){
        refreshSession().catch(e=>showError(errorMessage(e)));
      }
    }, e=>console.warn('계정 상태 업데이트 불가:',e));
  } catch(e) { view('error','연결 오류','계정 정보를 불러오지 못했습니다.',errorMessage(e)); }
}

gate.addEventListener('submit',event=>{
  event.preventDefault();
  const form=event.target;
  const entries=Object.fromEntries(new FormData(form));
  guarded(async()=>{
    if(form.id==='loginForm') {
      await signInWithEmailAndPassword(auth, String(entries.email).trim(), String(entries.password));
      await refreshSession();
    } else if(form.id==='signupForm') {
      if(entries.password!==entries.confirmPassword)throw Error('비밀번호 확인 값이 일치하지 않습니다.');
      joiningNickname=String(entries.nickname||'').trim().slice(0,30);
      if(!joiningNickname)throw Error('닉네임을 입력해 주세요.');
      registering=true;
      try {
        const cred=await createUserWithEmailAndPassword(auth,String(entries.email).trim(),String(entries.password));
        await ensureProfile(cred.user);
        await sendEmailVerification(cred.user);
        joiningNickname='';
      } finally { registering=false; }
      await refreshSession();
    } else if(form.id==='resetForm') {
      await sendPasswordResetEmail(auth,String(entries.email).trim());
      view('login','재설정 메일 요청 완료','해당 계정이 존재하면 비밀번호 재설정 안내를 받을 수 있습니다.');
    }
  });
});
gate.addEventListener('click',event=>{
  const action=event.target.closest('[data-cloud-action]')?.dataset.cloudAction;
  if(!action)return;
  if(action==='login'||action==='signup'||action==='reset')view(action,action==='login'?'My Library':action==='signup'?'회원가입 신청':'비밀번호 재설정',action==='login'?'승인된 계정으로 로그인하세요.':'회원가입 후 이메일 인증 및 관리자 승인이 필요합니다.');
  else guarded(async()=>{
    if(action==='logout'){await signOut(auth);location.reload();}
    if(action==='refresh')await refreshSession();
    if(action==='resend'){await sendEmailVerification(auth.currentUser);showError('인증 메일을 다시 보냈습니다.');}
  });
});
window.addEventListener('focus',async()=>{
  if(!loadedUid||!auth?.currentUser||!currentProfile||Date.now()-lastDataRefresh<30000)return;
  if(window.LibraryBridge?.busy?.())return;
  lastDataRefresh=Date.now();
  try{
    const fresh=await cloudApiFor(loadedUid).load();
    if(auth.currentUser?.uid===loadedUid)await window.LibraryBridge.refresh(fresh);
  }catch(e){console.warn('새로고침 시 서버 동기화 실패',e);}
});

document.addEventListener('my-library-signout',async()=>{
  try{await signOut(auth);location.reload()}catch(e){console.warn('로그아웃 실패',e);}
});

if(!configured) {
  view('missing','Firebase 설정 필요','배포 전 firebase-config.js 값을 입력해야 합니다.','DEPLOY_KO.md 안내에 따라 Firebase 웹 앱 설정을 복사하세요.');
 } else {
  try {
    const [appMod,authMod,firestoreMod]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js')
    ]);
    ({initializeApp}=appMod);
    ({getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword,
      sendEmailVerification,sendPasswordResetEmail,signOut,onAuthStateChanged,reload:reloadAuthUser}=authMod);
    ({getFirestore,doc,collection,getDoc,getDocs,setDoc,updateDoc,serverTimestamp,runTransaction,writeBatch,onSnapshot}=firestoreMod);
    const app=initializeApp(firebaseConfig);
    auth=getAuth(app);auth.languageCode='ko';
    database=getFirestore(app);
    onAuthStateChanged(auth,()=>{if(!registering)refreshSession().catch(e=>console.error(e));});
  } catch(e) {view('error','초기화 오류','Firebase 연결 설정을 확인하세요.',errorMessage(e));}
}
