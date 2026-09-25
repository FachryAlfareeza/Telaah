import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { apiMiddleware } from './server/api.js';
const api = { name:'telaah-api', configureServer(server) { server.middlewares.use(apiMiddleware); }, configurePreviewServer(server) { server.middlewares.use(apiMiddleware); } };
export default defineConfig({ plugins: [tailwindcss(),api], server:{ fs:{ deny:['.env','.env.*','**/.git/**','**/data/**','**/server/**'] } } });
