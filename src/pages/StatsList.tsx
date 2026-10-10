// 통계 목록. 데이터 연결은 plan/0001의 다음 단계에서 한다. 지금은 층의 입구와 성격만 보인다.
import DeskLayout, { Disclaimer } from '../components/layout/DeskLayout';

export default function StatsList() {
  return (
    <DeskLayout>
      <h1>통계</h1>
      <p className="desk-lead">기록과 공식 표를 계산한 결과다. 지도는 질문 하나에 한 장이다. 피드, 미확인 제보, 좌표 없는 카드는 모수와 지도에 넣지 않는다.</p>
      <Disclaimer />
      <p>아직 공개한 분석이 없다.</p>
    </DeskLayout>
  );
}
