// 개인정보 보유 기간과 처리 위탁·국외 이전(0005 명세 1~3장). 제보 폼 동의와 처리방침이 같은 표를 쓴다.
// Supabase 리전을 바꾸면 SUPABASE_PROCESSOR의 국가를 고친다.

export const PRIVACY_EFFECTIVE_DATE = '2026-10-11';

export const RETENTION: readonly (readonly [string, string])[] = [
  ['이름·연락처', '검수가 끝나면 즉시 파기. 검수 전이라도 접수 후 90일이 지나면 파기'],
  ['접속 IP 변환값', '접수 후 1일'],
  ['기각한 제보의 원문·첨부 파일', '검수가 끝나면 즉시 파기'],
  ['채택한 제보의 원문·첨부 파일', '그 제보로 만든 기록을 공개하는 동안. 기록을 지우면 파기'],
  ['검수하지 않은 제보의 원문·첨부 파일', '접수 후 1년'],
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
  country: '호주(시드니)',
  contact: 'privacy@supabase.com',
  task: '제보 저장과 처리(데이터베이스, 파일 저장소)',
  items: '제보 내용(장소, 시각, 내용, 링크), 첨부 파일, 접속 IP 변환값, 적은 경우 이름·연락처',
  when: '제보를 보낼 때 암호화된 네트워크(HTTPS)로 전송',
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
