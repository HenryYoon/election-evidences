// 제보 목록. 데이터 연결은 plan/0001의 다음 단계에서 한다. 지금은 층의 입구와 성격만 보인다.
import DeskLayout from '../components/layout/DeskLayout';

export default function TipList() {
  return (
    <DeskLayout>
      <h1>제보</h1>
      <p className="desk-lead">시민 제보다. 기본 상태는 미확인이다. 제보자의 이름과 연락처는 공개하지 않는다.</p>
      <p>아직 공개한 제보가 없다.</p>
    </DeskLayout>
  );
}
