// 개인정보 보유 기간과 처리 위탁·국외 이전(0005 명세 1~3장). 제보 폼 동의와 처리방침이 같은 표를 쓴다.
// Supabase는 서울 리전이라 국내 처리 위탁이다(0009). 리전을 바꾸면 country와 처리방침 5장을 함께 고친다.

export const PRIVACY_EFFECTIVE_DATE = '2026-10-25';

export const RETENTION: readonly (readonly [string, string])[] = [
  ['이름·연락처', '검수가 끝나면 즉시 파기. 검수 전이라도 접수 후 90일이 지나면 파기'],
  ['접속 IP 변환값', '접수 후 1일'],
  ['기각한 제보의 원문·첨부 파일', '검수가 끝나면 즉시 파기'],
  ['채택한 제보의 원문·첨부 파일', '그 제보로 만든 기록을 공개하는 동안. 기록을 지우면 파기'],
  ['검수하지 않은 제보의 원문·첨부 파일', '접수 후 1년'],
];

// 문의(0006 명세 3장).
export const INQUIRY_RETENTION: readonly (readonly [string, string])[] = [
  ['문의 내용과 회신 이메일', '접수 후 1년. 운영자 메일함의 사본도 같은 기간 뒤 지운다'],
  ['접속 IP 변환값', '접수 후 1일'],
];

export interface Processor {
  name: string;
  country: string;
  contact: string;
  task: string;
  items: string;
  when: string;
}

export const SUPABASE_PROCESSOR: Processor = {
  name: 'Supabase',
  country: '대한민국(서울)',
  contact: 'privacy@supabase.com',
  task: '제보 저장과 처리(데이터베이스, 파일 저장소)',
  items: '제보 내용(장소, 시각, 내용, 링크), 첨부 파일, 접속 IP 변환값, 적은 경우 이름·연락처',
  when: '제보를 보낼 때 암호화된 네트워크(HTTPS)로 전송',
};

export const SUPABASE_INQUIRY: Processor = {
  name: SUPABASE_PROCESSOR.name,
  country: SUPABASE_PROCESSOR.country,
  contact: SUPABASE_PROCESSOR.contact,
  when: '문의를 보낼 때 암호화된 네트워크(HTTPS)로 전송',
  task: '문의 저장',
  items: '문의 종류, 내용, 접속 IP 변환값, 적은 경우 회신 이메일',
};

export const RESEND_PROCESSOR: Processor = {
  name: 'Resend(Plus Five Five, Inc.)',
  country: '미국',
  contact: 'privacy@resend.com',
  task: '문의를 운영자 메일로 전달',
  items: '문의 종류, 내용, 적은 경우 회신 이메일',
  when: '문의를 보낼 때 암호화된 네트워크(HTTPS)로 전송',
};

export const VERCEL_PROCESSOR: Processor = {
  name: 'Vercel',
  country: '미국',
  contact: 'privacy@vercel.com',
  task: '사이트 전송(호스팅)과 접속 기록',
  items: '접속 IP, 브라우저 정보, 접속 시각',
  when: '사이트에 접속할 때 암호화된 네트워크(HTTPS)로 전송',
};

export const REQUIRED_ITEMS = '장소, 시각, 내용, 링크, 첨부 파일(파일 속 촬영 위치·시각 정보 포함), 접속 IP 변환값';
export const REQUIRED_PURPOSE = '제보 사실 확인과 검수, 채택한 제보로 기록 작성, 같은 사람의 반복 전송 제한';
export const OPTIONAL_ITEMS = '이름, 연락처(전화, 이메일, 계정)';
export const OPTIONAL_PURPOSE = '제보 내용을 확인하기 위한 연락';

export const INQUIRY_ITEMS = '문의 종류, 내용, 접속 IP 변환값';
export const INQUIRY_PURPOSE = '문의·건의·정정·개인정보 요청 처리, 같은 사람의 반복 전송 제한';
export const INQUIRY_OPTIONAL_ITEMS = '회신 이메일';
export const INQUIRY_OPTIONAL_PURPOSE = '문의에 대한 답장';
