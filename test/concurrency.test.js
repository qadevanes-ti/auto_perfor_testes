const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createServer } = require('../src/server');

test('requisições simultâneas não duplicam pagamento nem gastam além do saldo', async (t) => {
  const server = createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (path, body, key) => {
    const r = await fetch(base + path, {
      method: 'POST', body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
    });
    return { status: r.status, body: await r.json() };
  };
  const from = (await post('/accounts', { balance: 1000 })).body.id;
  const to = (await post('/accounts', { balance: 0 })).body.id;
  const results = await Promise.all(Array.from({ length: 20 }, () => post('/payments', { from, to, amount: 100 }, 'same-key')));
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  assert.equal(results.filter((r) => r.status === 200).length, 19);
  assert.equal(new Set(results.map((r) => r.body.id)).size, 1);
  const competing = await Promise.all(Array.from({ length: 20 }, (_, i) => post('/payments', { from, to, amount: 100 }, `new-${i}`)));
  assert.equal(competing.filter((r) => r.status === 201).length, 9);
  assert.equal(competing.filter((r) => r.status === 422 && r.body.error === 'INSUFFICIENT_FUNDS').length, 11);
  assert.equal((await (await fetch(`${base}/accounts/${from}`)).json()).balance, 0);
  assert.equal((await (await fetch(`${base}/accounts/${to}`)).json()).balance, 1000);
});
