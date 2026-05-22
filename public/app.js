const statusBox = document.querySelector('#status');
const meBox = document.querySelector('#meBox');
const logBox = document.querySelector('#log');
const secondFactorForm = document.querySelector('#secondFactorForm');
const challengeTokenInput = document.querySelector('#challengeToken');
const provisioningUriInput = document.querySelector('#provisioningUri');
const manualSecretInput = document.querySelector('#manualSecret');
const recoveryCodesBox = document.querySelector('#recoveryCodes');

const testUsername = `tester${Math.floor(100000 + Math.random() * 900000)}`;
document.querySelector('#registerForm input[name="username"]').value = testUsername;
document.querySelector('#registerForm input[name="email"]').value = `${testUsername}@example.com`;
document.querySelector('#loginForm input[name="username"]').value = testUsername;

function log(message, data) {
  const time = new Date().toLocaleTimeString();
  const suffix = data === undefined ? '' : `\n${JSON.stringify(data, null, 2)}`;
  logBox.textContent = `[${time}] ${message}${suffix}\n\n${logBox.textContent}`;
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

async function api(path, options = {}) {
  const hasBody = options.body !== undefined;
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: hasBody
      ? {
          'Content-Type': 'application/json',
          ...(options.headers ?? {})
        }
      : options.headers,
    ...options,
    body: hasBody ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(data.message ?? 'Request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function setStatus(text, mode = '') {
  statusBox.textContent = text;
  statusBox.className = `status ${mode}`.trim();
}

async function refreshMe() {
  try {
    const data = await api('/me');
    meBox.textContent = JSON.stringify(data, null, 2);
    setStatus(`Signed in as ${data.user.username}`, 'ok');
    return data;
  } catch (error) {
    meBox.textContent = JSON.stringify(error.data ?? { message: error.message }, null, 2);
    setStatus('Not signed in', 'warn');
    return null;
  }
}

document.querySelector('#registerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: formData(event.currentTarget)
    });
    log('Registered', data);
    await refreshMe();
  } catch (error) {
    log('Register failed. If the username already exists, use a new one.', error.data ?? { message: error.message });
  }
});

document.querySelector('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: formData(event.currentTarget)
    });
    log('Login response', data);

    if (data.status === 'requires_2fa') {
      challengeTokenInput.value = data.challengeToken;
      secondFactorForm.classList.remove('hidden');
      setStatus('Second factor required');
      return;
    }

    secondFactorForm.classList.add('hidden');
    await refreshMe();
  } catch (error) {
    log('Login failed', error.data ?? { message: error.message });
  }
});

secondFactorForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const data = await api('/auth/login/2fa', {
      method: 'POST',
      body: formData(event.currentTarget)
    });
    log('2FA login completed', data);
    secondFactorForm.classList.add('hidden');
    await refreshMe();
  } catch (error) {
    log('2FA login failed', error.data ?? { message: error.message });
  }
});

document.querySelector('#refreshMe').addEventListener('click', async () => {
  const data = await refreshMe();
  if (data) {
    log('Current session', data);
  } else {
    log('No active session');
  }
});

document.querySelector('#logout').addEventListener('click', async () => {
  try {
    const data = await api('/auth/logout', { method: 'POST' });
    log('Logged out', data);
    await refreshMe();
  } catch (error) {
    log('Logout failed', error.data ?? { message: error.message });
  }
});

document.querySelector('#reauthForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = formData(event.currentTarget);
  if (!body.secondFactorMethod) delete body.secondFactorMethod;
  if (!body.secondFactorCode) delete body.secondFactorCode;

  try {
    const data = await api('/auth/reauthenticate', {
      method: 'POST',
      body
    });
    log('Reauthenticated', data);
  } catch (error) {
    log('Reauthentication failed', error.data ?? { message: error.message });
  }
});

document.querySelector('#start2fa').addEventListener('click', async () => {
  try {
    const data = await api('/2fa/setup', { method: 'POST' });
    provisioningUriInput.value = data.provisioningUri;
    manualSecretInput.value = new URL(data.provisioningUri).searchParams.get('secret') ?? '';
    log('2FA setup started', data);
  } catch (error) {
    log('2FA setup failed. You must be logged in and recently reauthenticated first.', error.data ?? { message: error.message });
  }
});

document.querySelector('#confirm2faForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const data = await api('/2fa/confirm', {
      method: 'POST',
      body: formData(event.currentTarget)
    });
    recoveryCodesBox.textContent = data.recoveryCodes.join('\n');
    log('2FA enabled. Save these recovery codes now.', data);
  } catch (error) {
    log('2FA confirmation failed', error.data ?? { message: error.message });
  }
});

document.querySelector('#disable2fa').addEventListener('click', async () => {
  try {
    const data = await api('/2fa', { method: 'DELETE' });
    provisioningUriInput.value = '';
    manualSecretInput.value = '';
    recoveryCodesBox.textContent = '2FA disabled.';
    log('2FA disabled', data);
  } catch (error) {
    log('Disable 2FA failed. You must reauthenticate with password and TOTP first.', error.data ?? { message: error.message });
  }
});

document.querySelector('#passwordForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const data = await api('/auth/password/change', {
      method: 'POST',
      body: formData(event.currentTarget)
    });
    log('Password changed', data);
  } catch (error) {
    log('Password change failed. You must reauthenticate first.', error.data ?? { message: error.message });
  }
});

refreshMe();
