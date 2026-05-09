/**
 * 개발/테스트용 데모 데이터를 Firestore에 삽입
 * 사용법: node scripts/seed-demo.js
 *
 * 삽입 데이터:
 * - academies: SMART1, TOPENG, BUDDY7 학원
 * - content: 천재교육 중3 3과 대화문 샘플
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function seed() {
  console.log('🌱 데모 데이터 삽입 시작...');

  // ── 1. 학원 데이터 ──
  const academies = [
    {
      id: 'academy-smart1',
      data: {
        name:         '새빛영어학원',
        joinCode:     'SMART1',
        teacherName:  '이재영 선생님',
        grade:        '중3 A반',
        maxStudents:  50,
        plan:         's50',
        createdAt:    admin.firestore.FieldValue.serverTimestamp(),
      },
    },
    {
      id: 'academy-topeng',
      data: {
        name:         '탑클래스학원',
        joinCode:     'TOPENG',
        teacherName:  '박선영 선생님',
        grade:        '중2 B반',
        maxStudents:  20,
        plan:         's20',
        createdAt:    admin.firestore.FieldValue.serverTimestamp(),
      },
    },
    {
      id: 'academy-buddy7',
      data: {
        name:         "G'day Mate 체험",
        joinCode:     'BUDDY7',
        teacherName:  '',
        grade:        '자유 학습',
        maxStudents:  100,
        plan:         's100',
        createdAt:    admin.firestore.FieldValue.serverTimestamp(),
      },
    },
  ];

  for (const { id, data } of academies) {
    await db.collection('academies').doc(id).set(data);
    await db.collection('joinCodes').doc(data.joinCode).set({
      academyId:   id,
      academyName: data.name,
      teacherName: data.teacherName,
      grade:       data.grade,
      active:      true,
      updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  ✅ 학원: ${data.name} (${data.joinCode})`);
  }

  // ── 2. 학습 자료 (대화문 샘플) ──
  const dialog_text = `Mina: Hi, Jake! Have you ever observed the night sky?
Jake: Yes, I have. My grandfather is an astronomer.
Mina: That's amazing! What did he teach you?
Jake: He taught me how to use a telescope last summer.
Mina: I've always wanted to learn more about the stars.
Jake: You should join our astronomy club!
Mina: Really? When does it meet?
Jake: Every Friday after school. It's really fun!`;

  const reading_text = `For most of human history, people have observed the night sky with wonder. Long before modern telescopes were invented, ancient astronomers used patterns of stars to track time and seasons. Yet the basic feeling of looking up and asking "what is out there?" has not changed. Today, satellites and powerful telescopes let us see galaxies that are billions of light-years away. The universe is so vast that even the fastest spacecraft would take thousands of years to reach the nearest star. Still, humans continue to explore, driven by the same curiosity that our ancestors felt when they first looked up at the stars.`;

  const contentItems = [
    {
      title:        '천재교육 중3 3과 대화문',
      publisher:    '천재교육',
      author:       '이재영',
      grade:        '중3',
      unit:         '3과',
      type:         'dialog',
      text:         dialog_text,
      wordCount:    28,
      stepCount:    6,
      quizCount:    20,
      assignedBy:   'demo-teacher',
      academyId:    'academy-smart1',
    },
    {
      title:        '천재교육 중3 3과 본문',
      publisher:    '천재교육',
      author:       '이재영',
      grade:        '중3',
      unit:         '3과',
      type:         'reading',
      text:         reading_text,
      wordCount:    45,
      stepCount:    6,
      quizCount:    20,
      assignedBy:   'demo-teacher',
      academyId:    'academy-smart1',
    },
    {
      title:        '천재교육 중3 3과 단어',
      publisher:    '천재교육',
      author:       '이재영',
      grade:        '중3',
      unit:         '3과',
      type:         'word',
      text:         '',
      wordCount:    40,
      stepCount:    4,
      quizCount:    0,
      assignedBy:   'demo-teacher',
      academyId:    'academy-smart1',
      words: [
        { word:'observe',   pos:'v.',   ko:'관찰하다',  def:'to look at carefully', syn:'watch',     grade:'중3' },
        { word:'ancient',   pos:'adj.', ko:'고대의',    def:'from early period',   syn:'old',       grade:'중3' },
        { word:'telescope', pos:'n.',   ko:'망원경',    def:'see distant things',  syn:'spyglass',  grade:'중3' },
        { word:'astronomer',pos:'n.',   ko:'천문학자',  def:'studies stars',       syn:'stargazer', grade:'중3' },
        { word:'wonder',    pos:'n.',   ko:'경이로움',  def:'feeling of amazement',syn:'amazement', grade:'중3' },
      ],
    },
  ];

  for (const item of contentItems) {
    const ref = await db.collection('content').add({
      ...item,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status:    'published',
    });
    console.log(`  ✅ 자료: ${item.title} (${ref.id})`);
  }

  console.log('\n🎉 데모 데이터 삽입 완료!');
  console.log('\n테스트 학원 코드:');
  console.log('  SMART1 — 새빛영어학원 · 중3');
  console.log('  TOPENG — 탑클래스학원 · 중2');
  console.log('  BUDDY7 — 개인 학습');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ 오류:', err);
  process.exit(1);
});
