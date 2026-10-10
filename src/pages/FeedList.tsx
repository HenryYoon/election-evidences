// 피드 목록. 데이터 연결은 plan/0001의 다음 단계에서 한다. 지금은 층의 입구와 성격만 보인다.
import DeskLayout from '../components/layout/DeskLayout';

export default function FeedList() {
  return (
    <DeskLayout>
      <h1>피드</h1>
      <p className="desk-lead">올공, 자혁 등 외부 발신처의 소식이다. 피드는 증거가 아니다. 기록 카드가 된 소식에만 기록 링크를 단다.</p>
      <p>아직 수집한 소식이 없다.</p>
    </DeskLayout>
  );
}
