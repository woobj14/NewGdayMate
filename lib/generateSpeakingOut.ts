// ═══════════════════════════════════════════════════════════════
// 📚 CT팀 (Content & Teacher) 소유 파일
// 원칙: 워크플로우 최적화 · 타입 수호 · 파싱 품질 · 엑셀 무결성 · 데이터 격리
// 수정 전 CLAUDE.md 확인 필수 | 타입 변경 시 LX팀 협의 필수
// ═══════════════════════════════════════════════════════════════
/**
 * 스피킹 아웃 트레이닝 엑셀 생성 유틸
 * 원본 파일 구조 분석 기반으로 완전 복제
 *
 * 시트 구성:
 *   1. 표지
 *   2. 단어           (A:B 영어 / D:E 한국어, 25×3 세트)
 *   3. 대화문 or 본문  (A:B 영어 / D:E 한국어)
 *   4. 단어 테스트 뜻쓰기  (B=수식, E 빈칸)
 *   5. 단어 테스트 단어쓰기 (B 빈칸, E=수식)
 *
 * 수식:
 *   - 타이틀: =_xlfn.TEXTJOIN(" ",TRUE,표지!B1,표지!C1,표지!D1,표지!E1,"단어")
 *   - 반복 타이틀: =A1
 *   - 뜻쓰기 B열: =단어!B2 ~ =단어!B76
 *   - 단어쓰기 E열: =단어!E2 ~ =단어!E76
 */

import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export interface WordEntry {
  en: string;
  ko: string;
}

export interface DialogLine {
  en: string;
  ko: string;
}

export interface DialogGroup {
  label: string;      // "대화문1"
  lines: DialogLine[];
}

export interface ReadingPage {
  titleEn?: string;
  titleKo?: string;
  lines: DialogLine[];
}

export interface SpeakingOutParams {
  contentType: '대화문' | '본문' | '단어';
  grade:       string;   // "중1"
  publisher:   string;   // "능률"
  author:      string;   // "김기택"
  unit:        string;   // "3과"
  words:       WordEntry[];       // 75개
  dialogs?:    DialogGroup[];
  reading?:    ReadingPage[];
}

// ── 셀 스타일 헬퍼 ──────────────────────────────
const TITLE_FONT = { name: 'Arial', bold: true, sz: 12 };
const BODY_FONT  = { name: 'Arial', sz: 11 };

function hdr(v: string | object) {
  return { v: typeof v === 'string' ? v : '', t: 's', s: { font: TITLE_FONT, alignment: { horizontal: 'center', vertical: 'center' } } };
}
function cell(v: string | number, align: 'left' | 'center' = 'left') {
  return { v, t: typeof v === 'number' ? 'n' : 's', s: { font: BODY_FONT, alignment: { horizontal: align, vertical: 'center' } } };
}
function formula(f: string, align: 'left' | 'center' = 'left') {
  return { f, t: 'str', s: { font: BODY_FONT, alignment: { horizontal: align, vertical: 'center' } } };
}
function titleFormula(f: string) {
  return { f, t: 'str', s: { font: TITLE_FONT, alignment: { horizontal: 'center', vertical: 'center' } } };
}

// ── 단어 시트 ────────────────────────────────────
function buildWordSheet(words: WordEntry[], grade: string, publisher: string, author: string, unit: string): XLSX.WorkSheet {
  const aoa: any[][] = [];

  // 주 타이틀 수식
  const mainTitle = `_xlfn.TEXTJOIN(" ",TRUE,표지!B1,표지!C1,표지!D1,표지!E1,"단어")`;

  const sets = [
    { data: words.slice(0, 25),  titleLeft: mainTitle, isMain: true  },
    { data: words.slice(25, 50), titleLeft: 'A1',      isMain: false },
    { data: words.slice(50, 75), titleLeft: 'A1',      isMain: false },
  ];

  for (const set of sets) {
    // 타이틀 행: [번호+타이틀병합], [], [단어], [번호+타이틀병합], []
    aoa.push([
      titleFormula(set.titleLeft),  // A — A:B 병합
      null,
      set.isMain ? cell('단어', 'center') : null,
      titleFormula('A1'),           // D — D:E 병합
      null,
    ]);

    // 데이터 행
    for (let i = 0; i < set.data.length; i++) {
      const w = set.data[i];
      aoa.push([
        cell(i + 1, 'center'),    // A: 번호
        cell(w.en, 'left'),        // B: 영어
        null,                       // C: 빈칸
        cell(i + 1, 'center'),    // D: 번호
        cell(w.ko, 'left'),        // E: 한국어
      ]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // 열 너비 (원본 일치)
  ws['!cols'] = [
    { wch: 6.3  },  // A
    { wch: 28.6 },  // B
    { wch: 5.3  },  // C
    { wch: 6.3  },  // D
    { wch: 29.4 },  // E
  ];

  // 병합: 타이틀 행 A:B 병합, D:E 병합 (행 1, 27, 53)
  ws['!merges'] = [
    { s:{r:0,c:0}, e:{r:0,c:1} },   // 행1 A:B
    { s:{r:0,c:3}, e:{r:0,c:4} },   // 행1 D:E
    { s:{r:26,c:0}, e:{r:26,c:1} }, // 행27 A:B
    { s:{r:26,c:3}, e:{r:26,c:4} }, // 행27 D:E
    { s:{r:52,c:0}, e:{r:52,c:1} }, // 행53 A:B
    { s:{r:52,c:3}, e:{r:52,c:4} }, // 행53 D:E
  ];

  return ws;
}

// ── 단어 테스트 뜻쓰기 ──────────────────────────
function buildTestMeaning(words: WordEntry[]): XLSX.WorkSheet {
  const aoa: any[][] = [];

  const sets = [
    { data: words.slice(0, 25),  startWordRow: 2  },
    { data: words.slice(25, 50), startWordRow: 28 },
    { data: words.slice(50, 75), startWordRow: 54 },
  ];

  for (const set of sets) {
    // 타이틀 — 단어 시트 참조
    aoa.push([
      titleFormula('단어!A1'),  // A:B 병합
      null,
      null,
      titleFormula('단어!D1'),  // D:E 병합
      null,
    ]);

    for (let i = 0; i < set.data.length; i++) {
      const wordRow = set.startWordRow + i;
      aoa.push([
        cell(i + 1, 'center'),               // A: 번호
        formula(`단어!B${wordRow}`, 'left'),  // B: 영어 (수식)
        null,                                  // C: 빈칸
        cell(i + 1, 'center'),               // D: 번호
        null,                                  // E: 빈칸 (학생 입력)
      ]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws['!cols'] = [
    { wch: 6.3  }, { wch: 28.6 }, { wch: 5.3  }, { wch: 6.3  }, { wch: 29.4 },
  ];
  ws['!merges'] = [
    { s:{r:0,c:0},  e:{r:0,c:1}  },
    { s:{r:0,c:3},  e:{r:0,c:4}  },
    { s:{r:26,c:0}, e:{r:26,c:1} },
    { s:{r:26,c:3}, e:{r:26,c:4} },
    { s:{r:52,c:0}, e:{r:52,c:1} },
    { s:{r:52,c:3}, e:{r:52,c:4} },
  ];

  return ws;
}

// ── 단어 테스트 단어쓰기 ────────────────────────
function buildTestSpelling(words: WordEntry[], grade: string, publisher: string, author: string, unit: string): XLSX.WorkSheet {
  const aoa: any[][] = [];
  const titleText = `${grade} ${publisher} ${author} ${unit} 단어`;

  const sets = [
    { data: words.slice(0, 25),  startWordRow: 2  },
    { data: words.slice(25, 50), startWordRow: 28 },
    { data: words.slice(50, 75), startWordRow: 54 },
  ];

  for (const set of sets) {
    aoa.push([
      hdr(titleText),  // A:B 병합
      null,
      null,
      hdr(titleText),  // D:E 병합
      null,
    ]);

    for (let i = 0; i < set.data.length; i++) {
      const wordRow = set.startWordRow + i;
      aoa.push([
        cell(i + 1, 'center'),               // A: 번호
        null,                                  // B: 빈칸 (학생 입력)
        null,                                  // C: 빈칸
        cell(i + 1, 'center'),               // D: 번호
        formula(`단어!E${wordRow}`, 'left'),  // E: 한국어 (수식)
      ]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws['!cols'] = [
    { wch: 6.3  }, { wch: 28.6 }, { wch: 5.3  }, { wch: 6.3  }, { wch: 29.4 },
  ];
  ws['!merges'] = [
    { s:{r:0,c:0},  e:{r:0,c:1}  },
    { s:{r:0,c:3},  e:{r:0,c:4}  },
    { s:{r:26,c:0}, e:{r:26,c:1} },
    { s:{r:26,c:3}, e:{r:26,c:4} },
    { s:{r:52,c:0}, e:{r:52,c:1} },
    { s:{r:52,c:3}, e:{r:52,c:4} },
  ];

  return ws;
}

// ── 대화문 시트 ──────────────────────────────────
function buildDialogSheet(dialogs: DialogGroup[]): XLSX.WorkSheet {
  const aoa: any[][] = [];
  const mainTitle = `_xlfn.TEXTJOIN(" ",TRUE,표지!B1,표지!C1,표지!D1,표지!E1,"대화문")`;

  const LINES_PER_PAGE = 21;
  let lineCount = 0;
  let pageCount = 0;

  // 페이지 헤더 추가 함수
  const addPageHeader = () => {
    const leftTitle = pageCount === 0 ? mainTitle : 'A1';
    aoa.push([
      titleFormula(leftTitle),
      null,
      pageCount === 0 ? cell('대화문', 'center') : null,
      titleFormula('A1'),
      null,
    ]);
    pageCount++;
    lineCount = 0;
  };

  addPageHeader();

  for (const grp of dialogs) {
    // 그룹 제목 (대화문1, 대화문2 ...)
    if (lineCount >= LINES_PER_PAGE) addPageHeader();
    aoa.push([null, cell(grp.label, 'left'), null, null, cell(grp.label, 'left')]);
    lineCount++;

    for (const line of grp.lines) {
      if (lineCount >= LINES_PER_PAGE) addPageHeader();
      const num = lineCount;
      aoa.push([
        cell(num, 'center'),
        cell(line.en, 'left'),
        null,
        cell(num, 'center'),
        cell(line.ko, 'left'),
      ]);
      lineCount++;
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 2.9  }, { wch: 36.4 }, { wch: 2.0 }, { wch: 2.9 }, { wch: 34.6 },
  ];

  return ws;
}

// ── 본문 시트 ─────────────────────────────────────
function buildReadingSheet(reading: ReadingPage[]): XLSX.WorkSheet {
  const aoa: any[][] = [];
  const mainTitle = `_xlfn.TEXTJOIN(" ",TRUE,표지!B1,표지!C1,표지!D1,표지!E1,"본문")`;

  const LINES_PER_PAGE = 21;
  let lineCount = 0;
  let pageCount = 0;

  const addPageHeader = () => {
    const leftTitle = pageCount === 0 ? mainTitle : 'A1';
    aoa.push([
      titleFormula(leftTitle),
      null,
      pageCount === 0 ? cell('본문', 'center') : null,
      titleFormula('A1'),
      null,
    ]);
    pageCount++;
    lineCount = 0;
  };

  addPageHeader();

  for (const pg of reading) {
    if (pg.titleEn) {
      if (lineCount >= LINES_PER_PAGE) addPageHeader();
      aoa.push([null, cell(pg.titleEn, 'left'), null, null, cell(pg.titleKo ?? '', 'left')]);
      lineCount++;
    }

    for (const line of pg.lines) {
      if (lineCount >= LINES_PER_PAGE) addPageHeader();
      const num = lineCount;
      aoa.push([
        cell(num, 'center'),
        cell(line.en, 'left'),
        null,
        cell(num, 'center'),
        cell(line.ko, 'left'),
      ]);
      lineCount++;
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 4.1 }, { wch: 31.7 }, { wch: 3.6 }, { wch: 4.1 }, { wch: 33.4 },
  ];
  return ws;
}

// ── 표지 시트 ─────────────────────────────────────
function buildCoverSheet(contentType: string, grade: string, publisher: string, author: string, unit: string): XLSX.WorkSheet {
  // A1:E1 메타 (숨겨진 입력 셀)
  const aoa: any[][] = [
    // 행1: 메타데이터
    [cell(contentType), cell(grade), cell(publisher), cell(author), cell(unit)],
    // 행2~5: 빈 행
    [], [], [], [],
    // 행6: 타입(=A1), 빈칸, 빈칸, 제목
    [null, null, null, formula('A1'), null, formula('_xlfn.TEXTJOIN(" ",TRUE,B1,C1,D1,E1)'), formula('""')],
    [], // 행7
    // 행8~10: 스스로 발화 노트
    [null, null, null, cell('스스로')],
    [null, null, null, cell('발화')],
    [null, null, null, cell('노트')],
    [], // 행11
    // 행12~15: 학년/출판사/저자/단원
    [null, null, null, formula('B1')],
    [null, null, null, formula('C1')],
    [null, null, null, formula('D1')],
    [null, null, null, formula('E1')],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 8 }, { wch: 14.5 }, { wch: 14 }, { wch: 25.3 }, { wch: 10 }, { wch: 14.1 }, { wch: 10 },
  ];

  return ws;
}

// ── 메인 생성 함수 ────────────────────────────────
export async function generateSpeakingOutXlsx(params: SpeakingOutParams): Promise<string> {
  const { contentType, grade, publisher, author, unit, words, dialogs, reading } = params;

  // words는 정확히 75개 필요
  const paddedWords = [...words];
  while (paddedWords.length < 75) paddedWords.push({ en: '', ko: '' });
  const words75 = paddedWords.slice(0, 75);

  const wb = XLSX.utils.book_new();

  // 1. 표지
  XLSX.utils.book_append_sheet(wb, buildCoverSheet(contentType, grade, publisher, author, unit), '표지');

  // 2. 단어
  XLSX.utils.book_append_sheet(wb, buildWordSheet(words75, grade, publisher, author, unit), '단어');

  // 3. 대화문 or 본문
  if (contentType === '대화문' && dialogs?.length) {
    XLSX.utils.book_append_sheet(wb, buildDialogSheet(dialogs), '대화문');
  } else if (contentType === '본문' && reading?.length) {
    XLSX.utils.book_append_sheet(wb, buildReadingSheet(reading), '본문');
  }

  // 4. 단어 테스트 뜻쓰기
  XLSX.utils.book_append_sheet(wb, buildTestMeaning(words75), '단어 테스트 뜻쓰기');

  // 5. 단어 테스트 단어쓰기
  XLSX.utils.book_append_sheet(wb, buildTestSpelling(words75, grade, publisher, author, unit), '단어 테스트 단어쓰기');

  // 파일로 저장
  const fileName = `스피킹아웃트레이닝_${grade}_${publisher}_${unit}_${Date.now()}.xlsx`;
  const filePath = `${FileSystem.documentDirectory}${fileName}`;

  const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  await FileSystem.writeAsStringAsync(filePath, wbout, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return filePath;
}

// 공유 (iOS Share Sheet / Android Share)
export async function shareSpeakingOutFile(filePath: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: '스피킹 아웃 트레이닝 저장',
    });
  }
}
