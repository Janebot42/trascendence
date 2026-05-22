import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authenticator } from 'otplib';

process.env.NODE_ENV = 'test';
process.env.TOTP_ENCRYPTION_KEY_BASE64 = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
process.env.OAUTH_42_CLIENT_ID = 'client-id';
process.env.OAUTH_42_CLIENT_SECRET = 'client-secret';
process.env.OAUTH_42_REDIRECT_URI = 'http://127.0.0.1:3000/auth/oauth/42/callback';
process.env.OAUTH_42_AUTHORIZE_URL = 'https://example.test/oauth/authorize';
process.env.OAUTH_42_TOKEN_URL = 'https://example.test/oauth/token';
process.env.OAUTH_42_ME_URL = 'https://example.test/v2/me';

const { buildApp } = await import('../../dist/app.js');

function cookieByName(response, name) {
  const raw = response.headers['set-cookie'];
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const match = values.find((value) => value.startsWith(`${name}=`));
  assert.ok(match);
  return match.split(';')[0];
}

function sessionCookie(response) {
  return cookieByName(response, 'sid');
}

function oauthCookie(response) {
  return cookieByName(response, 'oauth42');
}

async function enableTwoFactor(app, cookie) {
  const reauth = await app.inject({
    method: 'POST',
    url: '/auth/reauthenticate',
    headers: { cookie },
    payload: { password: 'correct horse battery staple' }
  });
  assert.equal(reauth.statusCode, 200);

  const setup = await app.inject({
    method: 'POST',
    url: '/2fa/setup',
    headers: { cookie }
  });
  assert.equal(setup.statusCode, 200);

  const secret = new URL(setup.json().provisioningUri).searchParams.get('secret');
  assert.ok(secret);

  const confirm = await app.inject({
    method: 'POST',
    url: '/2fa/confirm',
    headers: { cookie },
    payload: { code: authenticator.generate(secret) }
  });
  assert.equal(confirm.statusCode, 200);

  return { secret, recoveryCodes: confirm.json().recoveryCodes };
}

test('starts OAuth login with redirect to 42 including state', async () => {
  const app = await buildApp();

  try {
    const response = await app.inject({ method: 'GET', url: '/auth/oauth/42' });
    assert.equal(response.statusCode, 302);
    assert.match(response.headers.location, /^https:\/\/example\.test\/oauth\/authorize\?/);
    const location = new URL(response.headers.location);
    assert.equal(location.searchParams.get('client_id'), 'client-id');
    assert.equal(location.searchParams.get('redirect_uri'), process.env.OAUTH_42_REDIRECT_URI);
    assert.equal(location.searchParams.get('response_type'), 'code');
    assert.ok(location.searchParams.get('state'));
    const startCookie = oauthCookie(response);
    assert.match(startCookie, /^oauth42=/);
    assert.match(decodeURIComponent(startCookie.split('=')[1]), /^[A-Za-z0-9_-]+$/);
  } finally {
    await app.close();
  }
});

test('rejects oauth callback with invalid state', async () => {
  const app = await buildApp();

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/auth/oauth/42/callback?code=fake-code&state=bad-state'
    });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, 'UNAUTHORIZED');
  } finally {
    await app.close();
  }
});

test('rejects oauth callback when browser cookie does not match the login start', async () => {
  const app = await buildApp();

  try {
    const start = await app.inject({ method: 'GET', url: '/auth/oauth/42' });
    const state = new URL(start.headers.location).searchParams.get('state');
    const response = await app.inject({
      method: 'GET',
      url: `/auth/oauth/42/callback?code=fake-code&state=${state}`
    });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, 'UNAUTHORIZED');
  } finally {
    await app.close();
  }
});

test('oauth callback creates a local session for a new 42 user', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    if (String(url) === process.env.OAUTH_42_TOKEN_URL) {
      const body = options.body instanceof URLSearchParams ? options.body : new URLSearchParams(options.body);
      assert.equal(body.get('client_id'), process.env.OAUTH_42_CLIENT_ID);
      assert.equal(body.get('client_secret'), process.env.OAUTH_42_CLIENT_SECRET);
      assert.equal(body.get('grant_type'), 'authorization_code');
      return new Response(JSON.stringify({ access_token: 'oauth-token', token_type: 'bearer' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (String(url) === process.env.OAUTH_42_ME_URL) {
      assert.equal(options.headers.Authorization, 'Bearer oauth-token');
      return new Response(
        JSON.stringify({
          id: 4242,
          login: 'pablo42',
          email: 'pablo42@example.test',
          displayname: 'Pablo 42'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    throw new Error(`Unexpected fetch ${url}`);
  };

  const app = await buildApp();

  try {
    const start = await app.inject({ method: 'GET', url: '/auth/oauth/42' });
    const state = new URL(start.headers.location).searchParams.get('state');
    const oauthCookieValue = oauthCookie(start);
    const callback = await app.inject({
      method: 'GET',
      url: `/auth/oauth/42/callback?code=ok-code&state=${state}`,
      headers: { cookie: oauthCookieValue }
    });

    assert.equal(callback.statusCode, 200);
    assert.equal(callback.json().status, 'authenticated');
    assert.equal(callback.json().user.username, 'pablo42');
    const sidCookie = sessionCookie(callback);

    const me = await app.inject({
      method: 'GET',
      url: '/me',
      headers: { cookie: sidCookie }
    });
    assert.equal(me.statusCode, 200);
    assert.equal(me.json().user.username, 'pablo42');
  } finally {
    global.fetch = originalFetch;
    await app.close();
  }
});

test('rejects oauth callback replay after successful consumption', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url) === process.env.OAUTH_42_TOKEN_URL) {
      return new Response(JSON.stringify({ access_token: 'oauth-token', token_type: 'bearer' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (String(url) === process.env.OAUTH_42_ME_URL) {
      return new Response(
        JSON.stringify({ id: 5150, login: 'replay42', email: 'replay42@example.test', displayname: 'Replay 42' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    throw new Error(`Unexpected fetch ${url}`);
  };

  const app = await buildApp();

  try {
    const start = await app.inject({ method: 'GET', url: '/auth/oauth/42' });
    const state = new URL(start.headers.location).searchParams.get('state');
    const oauthCookieValue = oauthCookie(start);

    const first = await app.inject({
      method: 'GET',
      url: `/auth/oauth/42/callback?code=ok-code&state=${state}`,
      headers: { cookie: oauthCookieValue }
    });
    assert.equal(first.statusCode, 200);
    assert.equal(first.json().status, 'authenticated');

    const replay = await app.inject({
      method: 'GET',
      url: `/auth/oauth/42/callback?code=ok-code&state=${state}`,
      headers: { cookie: oauthCookieValue }
    });
    assert.equal(replay.statusCode, 401);
    assert.equal(replay.json().error, 'UNAUTHORIZED');
  } finally {
    global.fetch = originalFetch;
    await app.close();
  }
});

test('rejects automatic linking to an existing local account by matching email only', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url) === process.env.OAUTH_42_TOKEN_URL) {
      return new Response(JSON.stringify({ access_token: 'oauth-token', token_type: 'bearer' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (String(url) === process.env.OAUTH_42_ME_URL) {
      return new Response(
        JSON.stringify({ id: 7331, login: 'other42', email: 'taken@example.test', displayname: 'Taken 42' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    throw new Error(`Unexpected fetch ${url}`);
  };

  const app = await buildApp();

  try {
    const register = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: 'localuser',
        email: 'taken@example.test',
        password: 'correct horse battery staple'
      }
    });
    assert.equal(register.statusCode, 200);

    const start = await app.inject({ method: 'GET', url: '/auth/oauth/42' });
    const state = new URL(start.headers.location).searchParams.get('state');
    const oauthCookieValue = oauthCookie(start);
    const callback = await app.inject({
      method: 'GET',
      url: `/auth/oauth/42/callback?code=ok-code&state=${state}`,
      headers: { cookie: oauthCookieValue }
    });

    assert.equal(callback.statusCode, 409);
    assert.equal(callback.json().error, 'OAUTH_ACCOUNT_LINK_REQUIRED');
  } finally {
    global.fetch = originalFetch;
    await app.close();
  }
});

test('oauth callback requires second factor when linked local user has TOTP enabled', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url) === process.env.OAUTH_42_TOKEN_URL) {
      return new Response(JSON.stringify({ access_token: 'oauth-token', token_type: 'bearer' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (String(url) === process.env.OAUTH_42_ME_URL) {
      return new Response(
        JSON.stringify({
          id: 9001,
          login: 'erin42',
          email: 'erin@example.test',
          displayname: 'Erin 42'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    throw new Error(`Unexpected fetch ${url}`);
  };

  const app = await buildApp();

  try {
    const register = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        username: 'erin42-local',
        email: 'erin@example.test',
        password: 'correct horse battery staple'
      }
    });
    assert.equal(register.statusCode, 200);
    const sidCookie = sessionCookie(register);

    const { secret } = await enableTwoFactor(app, sidCookie);
    assert.ok(secret);

    await app.testContext.oauthRepository.createAccount({
      userId: register.json().user.id,
      provider: '42',
      providerUserId: '9001',
      providerLogin: 'erin42',
      providerEmail: 'erin@example.test'
    });

    const start = await app.inject({ method: 'GET', url: '/auth/oauth/42' });
    const state = new URL(start.headers.location).searchParams.get('state');
    const oauthCookieValue = oauthCookie(start);
    const callback = await app.inject({
      method: 'GET',
      url: `/auth/oauth/42/callback?code=ok-code&state=${state}`,
      headers: { cookie: oauthCookieValue }
    });

    assert.equal(callback.statusCode, 200);
    assert.equal(callback.json().status, 'requires_2fa');
    assert.ok(callback.json().challengeToken);
    const callbackCookies = Array.isArray(callback.headers['set-cookie'])
      ? callback.headers['set-cookie']
      : [callback.headers['set-cookie']];
    assert.ok(callbackCookies.some((value) => value.startsWith('oauth42=')));

    const complete = await app.inject({
      method: 'POST',
      url: '/auth/login/2fa',
      payload: {
        challengeToken: callback.json().challengeToken,
        method: 'totp',
        code: authenticator.generate(secret)
      }
    });
    assert.equal(complete.statusCode, 200);
    assert.equal(complete.json().status, 'authenticated');
    sessionCookie(complete);
  } finally {
    global.fetch = originalFetch;
    await app.close();
  }
});
