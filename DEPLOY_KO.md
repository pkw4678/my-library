# My Library v3.1 무료 배포 안내

이 패키지는 **실제 Firebase 프로젝트 정보가 아직 없는 배포 준비본**이다. 아래 단계를 완료해야 회원가입, 승인 및 데이터 저장이 동작한다.

## 0. 이전 v3.0 기록 백업

1. 기존 My Library v3.0을 실행한다.
2. 설정 또는 상단 백업 버튼에서 **JSON 백업**을 내려받는다.
3. 백업 파일을 다른 안전한 위치에도 보관한다.
4. v3.1에서는 **자동으로 기존 브라우저 기록을 가져오지 않는다**. 새 계정 승인 후 JSON 가져오기로 이전한다.

## 1. Firebase 프로젝트 생성

1. https://console.firebase.google.com/ 접속 → **프로젝트 추가**.
2. Spark(무료) 플랜을 유지한다. 결제 계정 업그레이드가 필요한 기능은 선택하지 않는다.
3. **프로젝트 개요 > 앱 추가 > 웹(</>)** 선택 후 웹 앱 등록.
4. SDK 설정 코드에서 `firebaseConfig` 값을 복사한다.
5. 이 패키지의 `firebase-config.js`에서 `apiKey`, `authDomain`, `projectId`, `appId`를 실제 값으로 교체한다.
   - 필요하다면 SDK 설정에 표시된 `messagingSenderId`, `storageBucket`도 추가할 수 있지만 이 버전에서는 사용하지 않는다.
   - Firebase Web 앱의 `apiKey`는 **브라우저 공개용 설정**이다. 서비스 계정 JSON과 비공개 관리자 키는 절대로 업로드하지 않는다.

## 2. 이메일 로그인 및 데이터베이스

1. **빌드 > Authentication > 시작하기 > 로그인 방법 > 이메일/비밀번호 활성화**.
2. **빌드 > Firestore Database > 데이터베이스 만들기**.
3. 기본 데이터베이스 `(default)`를 **Standard** 기준으로 만든다. 위치는 생성 후 변경이 어려우니 신중히 고른다.
4. 데이터베이스의 **규칙(Rules)** 탭에 `firestore.rules`의 **전체 내용**을 붙여넣고 게시한다.
5. `allow read, write: if true` 같은 공개 규칙은 절대 사용하지 않는다.
6. **Authentication > 설정 > 승인된 도메인(Authorized domains)** 에 배포 도메인(예: `USERNAME.github.io`)을 등록한다.
7. 이메일 인증 템플릿의 발신자·메시지를 확인한다. 회원가입 후 Firebase 인증 메일이 전송된다.

## 3. GitHub Pages 무료 호스팅

1. https://github.com/ 에서 **Public(공개)** 저장소 `my-library` 생성.
2. `index.html`, `admin.html`, `cloud.js`, `admin.js`, `firebase-config.js`, `.nojekyll` 등 이 패키지 파일을 저장소의 **최상위 폴더**에 업로드.
3. 저장소에서 **Settings > Pages > Build and deployment > Deploy from a branch**.
4. 브랜치 `main`, 폴더 `/(root)`를 선택하고 저장한다.
5. 일반 사용자 페이지: `https://USERNAME.github.io/my-library/`
6. 관리자 페이지: `https://USERNAME.github.io/my-library/admin.html`
7. 배포는 푸시 후 자동 진행되며, 실제 반영까지 수분이 걸릴 수 있다. 필요 시 강력 새로고침한다.

**중요:** GitHub Pages의 무료 공개 저장소에는 HTML/JavaScript 소스가 공개된다. 인증/접근권한은 반드시 Firebase 보안 규칙으로 집행한다.

## 4. 첫 관리자 계정 만들기 (1회 수동 설정)

1. 게시된 일반 사용자 페이지에서 본인 계정으로 회원가입한다.
2. 받은 이메일의 **이메일 인증 링크**를 클릭한다.
3. Firebase Console > Firestore Database > 데이터에서 `users` 컬렉션을 확인한다.
4. 본인의 `users/{UID}` 문서를 연다.
5. `role` 필드를 문자열 `admin`으로 변경한다.
6. `status` 필드를 문자열 `approved`로 변경한다.
7. 일반 페이지에서 로그아웃 후 로그인하고, `admin.html`을 연다.
8. 이후 다른 사용자는 회원가입과 인증 후 `pending` 상태로 신청되고, 이 관리자 화면에서 승인한다.

관리자를 자동 승격시키는 클라이언트 코드는 의도적으로 없다. 본인의 UID/이메일을 다른 사람과 혼동하지 않도록 주의한다.

## 5. 회원가입·승인 테스트

1. 별도 이메일로 일반 회원 가입 후 인증한다.
2. 그 사용자는 **가입 승인 대기** 화면만 보이는지 확인한다.
3. 관리자 화면에서 가입자에게 **승인** 버튼을 누른다.
4. 새 회원이 새로고침/상태 갱신 후 라이브러리에 입장하는지 확인한다.
5. 작품 등록 → 재로그인 → 다른 브라우저/기기 접속 후 동기화를 확인한다.
6. 관리자에서 **이용 정지** 시 작품 저장이 Firestore 규칙으로 차단되는지 확인한다.

## 6. 기존 작품 데이터 가져오기

1. 승인된 계정에서 라이브러리의 JSON 가져오기 기능을 연다.
2. 기존 v3.0의 백업 파일을 선택한다.
3. 병합 또는 교체를 선택한다. 기존 내용이 있다면 먼저 새 계정에서 또 다른 JSON 백업을 받는다.
4. 작품, 컬렉션, 즐겨찾기, 날짜, 감상 기록을 확인한다.

## 7. 업데이트 배포

- 화면/기능 수정: `index.html` 또는 `admin.html` 파일을 GitHub 저장소에서 교체 후 커밋한다.
- 계정/저장 동작 수정: `cloud.js`, `admin.js`도 함께 교체한다.
- 보안 정책 수정: **GitHub 교체만으로 끝나지 않고**, Firebase Console의 Firestore Rules도 별도로 게시해야 한다.
- 새 버전 호환성에 의문이 있으면 배포 전에 JSON 백업을 받는다.
- 브라우저 캐시가 남아 있을 수 있으므로 필요 시 새로고침한다.

## 무료 운영 및 한계

- GitHub Pages: GitHub Free의 공개 저장소에서 무료 정적 호스팅.
- Firebase: Spark 플랜 유지, Firestore 무료 할당량 내 이용. 한도 도달 시 요청이 차단될 수 있다.
- 유료 Cloud Functions, Cloud Storage 업로드, SMS 로그인 등의 기능은 이 패키지에 포함하지 않는다.
- 이메일/비밀번호, 이메일 인증과 사용자별 Firestore 보안 규칙을 사용한다.
- 표지는 외부 이미지 URL을 참조하므로 원본 사이트에서 외부 연결을 차단하면 표시되지 않을 수 있다.
- 관리자에게 새 신청이 자동 이메일로 오지는 않는다. `admin.html`에서 확인한다.
- 이메일 인증 메일이 도착하지 않으면 스팸함과 Firebase Authentication의 발송 할당량을 확인한다.
- 브라우저 임시 초안 및 로컬 복구 지점은 다른 기기에 동기화되지 않는다. 영구 기록은 Firebase에 저장된다.

## 장애·오류 확인

- `Firebase 설정 필요`: `firebase-config.js`의 값이 교체되지 않았다.
- `auth/unauthorized-domain`: Firebase Authentication 승인된 도메인을 확인한다.
- `permission-denied`: Firestore Rules, 이메일 인증, 계정 승인 상태를 확인한다.
- `auth/invalid-credential`: 이메일/비밀번호 확인.
- 승인 후에도 대기 화면: 새로고침하고 `users/{UID}`의 `status` 확인.
- 검색/표지 일부 누락: 외부 콘텐츠 API 문제 가능. Firebase 연결 문제와 별개.
- 네트워크 오류: 저장 전 입력했던 내용은 계정별 편집 초안으로 남을 수 있지만 모든 작업이 자동 동기화되는 것은 아니다. 재연결 후 상태 확인과 JSON 백업을 권장한다.

참고 공식 문서:
- https://firebase.google.com/docs/auth/web/start
- https://firebase.google.com/docs/firestore/security/get-started
- https://firebase.google.com/docs/firestore/quotas
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
