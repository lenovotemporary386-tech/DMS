import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // The correct Cloudflare IP for the Supabase project
  // (local DNS returns a stale/wrong IP)
  const SUPABASE_CORRECT_IP = '104.18.38.10';
  const SUPABASE_HOST = 'nrawxqenzvvjmanmgoap.supabase.co';

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        // Proxy /supabase-api to the correct Supabase IP
        '/supabase-api': {
          target: `https://${SUPABASE_CORRECT_IP}`,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/supabase-api/, ''),
          headers: {
            'Host': SUPABASE_HOST,
          },
        },
      },
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
