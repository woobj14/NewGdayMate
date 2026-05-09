/**
 * 특정 이메일 계정에 관리자 권한 부여
 * 사용법: node scripts/set-admin.js your-email@example.com
 *
 * 사전 준비:
 * 1. npm install firebase-admin
 * 2. Firebase Console → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성
 * 3. 다운로드한 JSON 파일을 scripts/serviceAccountKey.json 으로 저장
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function setAdmin(email) {
  if (!email) {
    console.error('이메일을 입력하세요: node scripts/set-admin.js email@example.com');
    process.exit(1);
  }

  try {
    // 이메일로 uid 조회
    const userRecord = await admin.auth().getUserByEmail(email);
    const uid = userRecord.uid;

    // Firestore users 문서에서 role을 admin으로 변경
    await db.collection('users').doc(uid).update({ role: 'admin' });

    console.log(`✅ 완료: ${email} → 관리자 권한 부여 (uid: ${uid})`);
    process.exit(0);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.error(`❌ 오류: ${email} 계정을 찾을 수 없습니다.`);
      console.error('   앱에서 먼저 회원가입한 후 이 스크립트를 실행하세요.');
    } else {
      console.error('❌ 오류:', err.message);
    }
    process.exit(1);
  }
}

const email = process.argv[2];
setAdmin(email);
