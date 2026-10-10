const TYPE_ICON: Record<string, string> = { 사진: '🖼', 영상: '▶', 음성: '🎧', 문서: '📄' };

// 관리자 화면과 기록 지도 마커가 쓰는 유형 표시.
export function typeIcon(t: string) {
  return TYPE_ICON[t] ?? '•';
}
