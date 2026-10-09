import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  server: { port: 5173 },
  // 서버 엔트리 빌드(dist-server)에는 public/ 복사가 필요 없다.
  build: { copyPublicDir: !isSsrBuild },
}))
