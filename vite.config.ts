import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({plugins:[react(),tailwindcss(),VitePWA({registerType:'autoUpdate',includeAssets:['icons/icon.svg','offline.html'],manifest:{name:'Family Expense',short_name:'Chi tiêu',description:'Quản lý chi tiêu gia đình',theme_color:'#124e3b',background_color:'#f7f7f2',display:'standalone',lang:'vi',icons:[{src:'/icons/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}]},workbox:{navigateFallback:'/index.html',globPatterns:['**/*.{js,css,html,svg}'],runtimeCaching:[]}})],test:{environment:'jsdom',setupFiles:['./src/test/setup.ts'],exclude:['tests/e2e/**','node_modules/**'],coverage:{reporter:['text','html']}}});
