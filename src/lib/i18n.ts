// 한국어·영어 화면 문구(0007 명세). 한국어 문구는 기존 상수를 그대로 가리킨다.
// 영어판은 메인과 소개만 있다. 나머지 페이지 링크는 한국어 페이지로 간다.
import { CIVIC_NOTE, HOW_STEPS, LAYER_LINES, SITE_PURPOSE } from './site';
import {
  EVIDENCE_STATUS_LABEL,
  EVIDENCE_STATUS_LEGEND,
  STATUS_DISCLAIMER,
  VERIFICATION_FIELDS,
  type EvidenceStatus,
} from './status';

export type Lang = 'ko' | 'en';
type VerificationKey = (typeof VERIFICATION_FIELDS)[number][0];

// 한국어 주소 ↔ 영어 주소. 짝이 없는 한국어 페이지에서 토글하면 영어 메인으로 간다.
export const LANG_PAIRS: readonly (readonly [string, string])[] = [
  ['/', '/en'],
  ['/about', '/en/about'],
];

export function langOf(path: string): Lang {
  return path === '/en' || path.startsWith('/en/') ? 'en' : 'ko';
}

export function counterpart(path: string): string {
  const pair = LANG_PAIRS.find(([ko, en]) => ko === path || en === path);
  if (pair) return langOf(path) === 'en' ? pair[0] : pair[1];
  return langOf(path) === 'en' ? '/' : '/en';
}

export function hasPair(path: string): boolean {
  return LANG_PAIRS.some(([ko, en]) => ko === path || en === path);
}

export interface Copy {
  siteName: string;
  siteShort: string;
  civicNote: string; // 민간 운영 표시
  purpose: string;
  disclaimer: string;
  how: readonly (readonly [string, string])[];
  layers: { records: string; tips: string };
  statusLabel: Record<EvidenceStatus, string>;
  statusLegend: Record<EvidenceStatus, string>;
  verificationLabel: Record<VerificationKey, string>;
  verificationHelp: Record<VerificationKey, string>;
  nav: { cases: string; records: string; tips: string; about: string; contact: string; privacy: string; toggle: string };
  koOnly: string; // 한국어 페이지로 가는 링크 옆 표시. 한국어판은 빈 문자열
  home: {
    collected: (n: number) => string;
    verified: (n: number) => string;
    aboutLink: string;
    mapLabel: string;
    mapTitle: string;
    mapNote: string;
    latestLabel: string;
    latestDay: (day: string) => string;
    latestNone: string;
    placeUnknown: string;
    source: string;
    noRecords: string;
    view: { records: string; tips: string };
    translationNote: string;
  };
  about: {
    title: string;
    lead: string;
    whatWeDo: string;
    layersTitle: string;
    layersNote: string;
    statusTitle: string;
    statusNote: string;
    verificationTitle: string;
    verificationNote: string;
    dontTitle: string;
    dont: readonly string[];
    contactTitle: string;
    contact: () => readonly [string, string];
  };
}

const VERIFICATION_LABEL_KO = Object.fromEntries(VERIFICATION_FIELDS) as Record<VerificationKey, string>;

export const COPY: Record<Lang, Copy> = {
  ko: {
    siteName: '선거부정진상규명국민신고센터',
    siteShort: '선진국',
    civicNote: CIVIC_NOTE,
    purpose: SITE_PURPOSE,
    disclaimer: STATUS_DISCLAIMER,
    how: HOW_STEPS,
    layers: LAYER_LINES,
    statusLabel: EVIDENCE_STATUS_LABEL,
    statusLegend: EVIDENCE_STATUS_LEGEND,
    verificationLabel: VERIFICATION_LABEL_KO,
    verificationHelp: {
      seen: '사진·영상·문서에 실제로 보이는 것.',
      where: '장소를 무엇으로 확인했는지.',
      when: '시각을 무엇으로 확인했는지.',
      notClaimed: '이 자료만으로는 말할 수 없는 것.',
    },
    nav: { cases: '대표 사례', records: '증거', tips: '제보', about: '소개', contact: '문의', privacy: '개인정보 처리방침', toggle: 'EN' },
    koOnly: '',
    home: {
      collected: (n) => `수집 ${n}건`,
      verified: (n) => `검증 ${n}건`,
      aboutLink: '이 사이트 소개',
      mapLabel: '증거 지도',
      mapTitle: '증거 위치',
      mapNote: '점은 장소가 확인된 증거다. 점을 누르면 증거로 간다.',
      latestLabel: '최근 증거',
      latestDay: (day) => `${day} 증거`,
      latestNone: '최근 증거',
      placeUnknown: '장소 미상',
      source: '출처',
      noRecords: '아직 증거가 없다.',
      view: { records: '2026 지방선거 증거 보기', tips: '제보하기' },
      translationNote: '',
    },
    about: {
      title: '소개',
      lead: `선거부정진상규명국민신고센터(선진국)는 ${SITE_PURPOSE} ${STATUS_DISCLAIMER}`,
      whatWeDo: '하는 일',
      layersTitle: '두 층',
      layersNote: '증거와 제보는 성격이 다르다. 제보는 검수를 거쳐야 증거가 된다. 두 층의 건수를 합치지 않는다.',
      statusTitle: '상태',
      statusNote: `증거마다 상태 하나를 붙인다. ${STATUS_DISCLAIMER} 문서 확인과 영상 확인은 운영진이 검증 네 줄을 채운 뒤에만 붙인다. 홈의 "검증" 건수는 이 두 상태의 증거 수다.`,
      verificationTitle: '검증 네 줄',
      verificationNote: '증거 상세 화면에는 아래 네 줄을 적는다. 확인한 것과 확인하지 않은 것을 나누기 위해서다.',
      dontTitle: '하지 않는 것',
      dont: [
        '상태로 위법 여부를 판단하지 않는다.',
        '확인하지 않은 내용을 확인한 것처럼 쓰지 않는다.',
        '제보를 검수 없이 공개하지 않는다.',
        '제보자 이름과 연락처를 어떤 화면에도 공개하지 않는다.',
        '사진과 영상 속 얼굴, 이름, 연락처는 가린 뒤 공개한다.',
      ],
      contactTitle: '정정과 문의',
      contact: () => [
        '증거에 틀린 내용이 있으면 ',
        '에서 "정정 요청"을 골라 알려 주세요. 해당 증거의 주소와 틀린 부분을 함께 적어 주세요. 운영진이 확인한 뒤 고칩니다. 건의와 그 밖의 문의도 같은 곳에서 받습니다.',
      ],
    },
  },
  en: {
    siteName: 'Citizen Report Center for Election Integrity',
    siteShort: 'SeonJinGuk',
    civicNote: 'This site is run by private citizens. It is not affiliated with the National Election Commission or any public body.',
    purpose:
      "We collect photos, videos, and documents from the early voting, election-day voting, and vote counting of Korea's June 3, 2026 local elections, and publish each one with its date, place, source, and verification status.",
    disclaimer: 'Status is an investigative classification, not a legal conclusion.',
    how: [
      ['Collect', 'We gather photos, videos, and documents from citizen tips and public sources.'],
      ['Check', 'Our editors check the date, place, and source, and write down what the material shows and what it does not claim.'],
      ['Publish', 'We publish only as much as we have checked, with a status label. Readers draw their own conclusions.'],
    ],
    layers: {
      records: 'Evidence cards with a verification status.',
      tips: 'Send what you saw or experienced. Reviewed tips become evidence.',
    },
    statusLabel: {
      document: 'Document verified',
      video_confirmed: 'Video verified',
      reported: 'Material received',
      allegation: 'Claim only',
    },
    statusLegend: {
      document: 'The content was confirmed against official documents or records.',
      video_confirmed: 'The place and time were confirmed from the original video.',
      reported: 'Photos or videos exist. The place and time have not been confirmed yet.',
      allegation: 'A claim without supporting material.',
    },
    verificationLabel: { seen: 'What is shown', where: 'Place', when: 'Time', notClaimed: 'What this does not claim' },
    verificationHelp: {
      seen: 'What actually appears in the photo, video, or document.',
      where: 'How the place was confirmed.',
      when: 'How the time was confirmed.',
      notClaimed: 'What cannot be concluded from this material alone.',
    },
    nav: { cases: 'Key cases', records: 'Evidence', tips: 'Tips', about: 'About', contact: 'Contact', privacy: 'Privacy policy', toggle: '한국어' },
    koOnly: ' (in Korean)',
    home: {
      collected: (n) => `${n} collected`,
      verified: (n) => `${n} verified`,
      aboutLink: 'About this site',
      mapLabel: 'Evidence map',
      mapTitle: 'Locations of evidence',
      mapNote: 'Each dot is a piece of evidence with a confirmed location. Select a dot to open it.',
      latestLabel: 'Latest evidence',
      latestDay: (day) => `Evidence from ${day}`,
      latestNone: 'Latest evidence',
      placeUnknown: 'Place unknown',
      source: 'Source',
      noRecords: 'No evidence yet.',
      view: { records: 'View 2026 local election evidence', tips: 'Send a tip' },
      translationNote: 'Evidence cards are in Korean for now. Status labels are translated.',
    },
    about: {
      title: 'About',
      lead: '',
      whatWeDo: 'What we do',
      layersTitle: 'Two layers',
      layersNote: 'Evidence and tips are different kinds of records. A tip becomes evidence only after review. We never add their counts together.',
      statusTitle: 'Status',
      statusNote:
        'Each piece of evidence gets one status. Status is an investigative classification, not a legal conclusion. "Document verified" and "Video verified" are assigned only after our editors fill in all four verification lines. The "verified" count on the home page is the number of evidence with one of those two statuses.',
      verificationTitle: 'Four verification lines',
      verificationNote: 'Each evidence page lists these four lines, to separate what we checked from what we did not.',
      dontTitle: 'What we do not do',
      dont: [
        'We do not use status to judge whether anything was illegal.',
        'We do not present unchecked content as checked.',
        'We do not publish tips without review.',
        'We never publish the names or contact details of people who send tips.',
        'We blur faces, names, and contact details in photos and videos before publishing.',
      ],
      contactTitle: 'Corrections and contact',
      contact: () => [
        'If a piece of evidence is wrong, use the ',
        ' form and choose "정정 요청" (correction request). Include the evidence address and what is wrong. You may write in English. We will check and fix it. Suggestions and other questions go to the same form.',
      ],
    },
  },
};
COPY.en.about.lead = `${COPY.en.siteName} (${COPY.en.siteShort}): ${COPY.en.purpose} ${COPY.en.disclaimer}`;

export const langPath = (lang: Lang, path: string) => (lang === 'en' ? (path === '/' ? '/en' : `/en${path}`) : path);
