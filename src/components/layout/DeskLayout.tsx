import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { STATUS_DISCLAIMER } from '../../lib/status';
import { COPY, counterpart, langPath, type Lang } from '../../lib/i18n';

// 공통 레이아웃: 상단 DESK 표시, 네 층 내비게이션, 소개, 언어 토글(0007), 아래 링크.
// 영어판은 메인과 소개만 있다. 층·문의·처리방침 링크는 한국어 페이지로 가고 "(in Korean)"을 붙인다.
export default function DeskLayout({ children, lang = 'ko' }: { children: ReactNode; lang?: Lang }) {
  const t = COPY[lang];
  const { pathname } = useLocation();
  const layers = [
    { to: '/records', label: t.nav.records },
    { to: '/stats', label: t.nav.stats },
    { to: '/feed', label: t.nav.feed },
    { to: '/tips', label: t.nav.tips },
  ];
  return (
    <div className="desk" lang={lang}>
      <header className="desk-top">
        <Link to={langPath(lang, '/')} className="mark">DESK</Link>
        <nav aria-label={lang === 'en' ? 'Layers (in Korean)' : '층'}>
          {layers.map((l) => (
            <NavLink key={l.to} to={l.to}>{l.label}</NavLink>
          ))}
        </nav>
        <NavLink to={langPath(lang, '/about')} end className="desk-about">{t.nav.about}</NavLink>
        <Link to={counterpart(pathname)} className="desk-lang" lang={lang === 'en' ? 'ko' : 'en'} hrefLang={lang === 'en' ? 'ko' : 'en'}>
          {t.nav.toggle}
        </Link>
      </header>
      <main className="desk-main">{children}</main>
      <footer className="desk-foot">
        <Link to={langPath(lang, '/about')}>{t.nav.about}</Link>
        <Link to="/contact">{t.nav.contact}{t.koOnly}</Link>
        <Link to="/privacy">{t.nav.privacy}{t.koOnly}</Link>
      </footer>
    </div>
  );
}

// 홈, 기록, 통계 첫 화면에 고정하는 문장(명세 1장).
export function Disclaimer() {
  return <p className="desk-disclaimer">{STATUS_DISCLAIMER}</p>;
}
