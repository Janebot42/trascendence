import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

const publicDir = join(process.cwd(), 'public');

export async function registerUiRoutes(app: FastifyInstance) {
  app.get('/', async (_request, reply) => {
    const html = await readFile(join(publicDir, 'index.html'), 'utf8');
    return reply.header('cache-control', 'no-store').type('text/html; charset=utf-8').send(html);
  });

  app.get('/ui/app.css', async (_request, reply) => {
    const css = await readFile(join(publicDir, 'app.css'), 'utf8');
    return reply.header('cache-control', 'no-store').type('text/css; charset=utf-8').send(css);
  });

  app.get('/ui/app.js', async (_request, reply) => {
    const js = await readFile(join(publicDir, 'app.js'), 'utf8');
    return reply.header('cache-control', 'no-store').type('application/javascript; charset=utf-8').send(js);
  });
}
