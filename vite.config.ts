import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 정리 글 초안은 PR 미리보기와 CASE_DRAFTS=1(CI·로컬)에서만 보인다(0010 명세 4장).
// 운영 빌드(VERCEL_ENV=production)에는 둘 다 없다.
// @types/node 없이 쓴다. 이 파일은 Node에서만 실행된다.
declare const process: { env: Record<string, string | undefined> }
const caseDrafts = process.env.VERCEL_ENV === 'preview' || process.env.CASE_DRAFTS === '1'

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  server: { port: 5173 },
  define: { __CASE_DRAFTS__: JSON.stringify(caseDrafts) },
  // 서버 엔트리 빌드(dist-server)에는 public/ 복사가 필요 없다.
  build: { copyPublicDir: !isSsrBuild },
}))
