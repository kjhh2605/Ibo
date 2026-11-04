// Invoke from repository root under scripts/emulator-lock.sh; never print tokens/logcat.
import {_android} from '../../../app/node_modules/playwright/index.mjs';
import {spawn, execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import assert from 'node:assert/strict';

const server = spawn('uv', ['--directory', 'relay', 'run', 'python', 'tests/core/live_auth_smoke.py'], {
  env: {...process.env, PYTHONPATH: '.'}, stdio: ['ignore', 'pipe', 'pipe'],
});
let device;
try {
  await Promise.race([
    new Promise((resolve, reject) => {
      server.stdout.on('data', data => {if (String(data).includes('S01_AUTH_READY')) resolve();});
      server.once('exit', () => reject(new Error('Diagnostic relay failed to start')));
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Diagnostic relay startup timeout')), 15000).unref()),
  ]);
  const devices = await _android.devices();
  assert.equal(devices.length, 1);
  device = devices[0];
  const webview = await device.webView({pkg: 'com.streetfitting.app'});
  const page = await webview.page();
  const tokens = await page.evaluate(() => window.Capacitor.nativePromise('SfAuth', 'getTokens', {}));
  assert.equal(typeof tokens.idToken, 'string');
  assert.equal(typeof tokens.appCheckToken, 'string');
  const headers = {'Content-Type': 'application/json', Authorization: 'Bearer ' + tokens.idToken, 'X-Firebase-AppCheck': tokens.appCheckToken};
  const request = JSON.stringify({origin: {lat: 0, lng: 0}, destination: {lat: 0.001, lng: 0.001}});
  const url = `http://127.0.0.1:${process.env.RELAY_PORT}/v1/route`;
  const mutate = token => {
    const parts = token.split('.');
    parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
    return parts.join('.');
  };
  const cases = [
    ['valid_native_tokens_reach_product_route', headers, request, 501],
    ['authenticated_principal_proof', headers, '{}', 200, url.replace('/route', '/core-auth-proof')],
    ['invalid_id_signature', {...headers, Authorization: 'Bearer ' + mutate(tokens.idToken)}, request, 401],
    ['invalid_appcheck_signature', {...headers, 'X-Firebase-AppCheck': mutate(tokens.appCheckToken)}, request, 403],
    ['missing_appcheck', {'Content-Type': 'application/json', Authorization: headers.Authorization}, request, 403],
    ['missing_auth_before_body_validation', {'Content-Type': 'application/json'}, 'invalid-json', 401],
    ['valid_auth_invalid_body', headers, '{"origin":{}}', 400],
  ];
  const results = [];
  for (const [name, selected, body, expected, endpoint = url] of cases) {
    const response = await fetch(endpoint, {method: 'POST', headers: {...selected, Origin: 'https://localhost'}, body});
    const value = await response.json();
    assert.equal(response.status, expected, name);
    assert.equal(response.headers.get('cache-control'), 'no-store', name);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://localhost', name);
    if (expected === 200) {
      assert.equal(value.authenticated, true);
      assert.match(value.pseudonym, /^[0-9a-f]{64}$/);
    }
    assert.equal(JSON.stringify(value).includes(tokens.idToken), false);
    assert.equal(JSON.stringify(value).includes(tokens.appCheckToken), false);
    results.push({name, status: response.status, noStore: true, cors: true, ...(value.error ? {code: value.error.code} : {})});
  }
  const logcat = execFileSync('adb', ['logcat', '-d'], {maxBuffer: 64 * 1024 * 1024, encoding: 'utf8'});
  const secret = readFileSync(`${homedir()}/.config/street-fitting/app-check-debug-token`, 'utf8').trim();
  assert.equal(logcat.includes(tokens.idToken), false, 'ID token logcat privacy');
  assert.equal(logcat.includes(tokens.appCheckToken), false, 'AppCheck logcat privacy');
  assert.equal(logcat.includes(secret), false, 'Debug secret logcat privacy');
  console.log(JSON.stringify({surface: 'existing Android SfAuth + real loopback HTTP + Firebase Admin public key verification',
    mockSkipAuth: false, results, secretOrTokenInLogcat: false, providerModelRequests: 0}, null, 2));
} catch (error) {
  // Playwright/native error objects can carry plugin payloads. Print only our classification.
  console.error('S01 live auth smoke failed: ' + (error instanceof assert.AssertionError ? error.message.split('\n')[0] : error?.code || error?.name || 'unknown'));
  process.exitCode = 1;
} finally {
  if (device) await device.close();
  if (server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    await exited;
  }
}
