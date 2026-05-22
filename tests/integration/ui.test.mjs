import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.TOTP_ENCRYPTION_KEY_BASE64 = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

const { buildApp } = await import('../../dist/app.js');

test('serves the manual auth test UI', async () => {
  const app = await buildApp();

  try {
    const html = await app.inject({ method: 'GET', url: '/' });
    assert.equal(html.statusCode, 200);
    assert.match(html.headers['content-type'], /text\/html/);
    assert.match(html.payload, /Auth Test UI/);

    const css = await app.inject({ method: 'GET', url: '/ui/app.css' });
    assert.equal(css.statusCode, 200);
    assert.match(css.headers['content-type'], /text\/css/);

    const js = await app.inject({ method: 'GET', url: '/ui/app.js' });
    assert.equal(js.statusCode, 200);
    assert.match(js.headers['content-type'], /application\/javascript/);
    assert.match(js.payload, /fetch/);
  } finally {
    await app.close();
  }
});
