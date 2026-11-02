const http = require('node:http');
const { randomUUID } = require('node:crypto');

// Estado isolado por instância. Valores monetários sempre em centavos inteiros.
function createServer() {
  const accounts = new Map();
  const payments = new Map();
  const keys = new Map();
  const server = http.createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    let body = {};
    try {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 16384) return send(413, { error: 'BODY_TOO_LARGE' });
      }
      if (raw) body = JSON.parse(raw);
      if (!body || Array.isArray(body) || typeof body !== 'object') return send(400, { error: 'INVALID_BODY' });
    } catch {
      return send(400, { error: 'INVALID_JSON' });
    }
    const path = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'GET' && path === '/health') return send(200, { status: 'ok' });
    if (req.method === 'POST' && path === '/accounts') {
      if (!Number.isSafeInteger(body.balance) || body.balance < 0 || body.balance > 1_000_000_000) {
        return send(422, { error: 'INVALID_BALANCE' });
      }
      const account = { id: randomUUID(), balance: body.balance };
      accounts.set(account.id, account);
      return send(201, account);
    }
    if (req.method === 'GET' && path.startsWith('/accounts/')) {
      const account = accounts.get(path.split('/')[2]);
      return account ? send(200, account) : send(404, { error: 'ACCOUNT_NOT_FOUND' });
    }
    if (req.method === 'POST' && path === '/payments') {
      const key = req.headers['idempotency-key'];
      if (!key || key.length > 128) return send(400, { error: 'INVALID_IDEMPOTENCY_KEY' });
      const { from, to, amount } = body;
      const fingerprint = JSON.stringify([from, to, amount]);
      if (keys.has(key)) {
        const previous = keys.get(key);
        return previous.fingerprint === fingerprint
          ? send(200, payments.get(previous.id))
          : send(409, { error: 'IDEMPOTENCY_CONFLICT' });
      }
      if (!Number.isSafeInteger(amount) || amount <= 0) return send(422, { error: 'INVALID_AMOUNT' });
      if (from === to) return send(422, { error: 'SAME_ACCOUNT' });
      const source = accounts.get(from);
      const target = accounts.get(to);
      if (!source || !target) return send(404, { error: 'ACCOUNT_NOT_FOUND' });
      if (source.balance < amount) return send(422, { error: 'INSUFFICIENT_FUNDS' });
      if (!Number.isSafeInteger(target.balance + amount)) return send(422, { error: 'BALANCE_OVERFLOW' });
      // Sem await entre validação e atualização: execução síncrona em um processo Node.
      source.balance -= amount;
      target.balance += amount;
      const payment = { id: randomUUID(), from, to, amount, status: 'APPROVED' };
      payments.set(payment.id, payment);
      keys.set(key, { fingerprint, id: payment.id });
      return send(201, payment);
    }
    const refund = path.match(/^\/payments\/([^/]+)\/refund$/);
    if (req.method === 'POST' && refund) {
      const payment = payments.get(refund[1]);
      if (!payment) return send(404, { error: 'PAYMENT_NOT_FOUND' });
      if (payment.status === 'REFUNDED') return send(200, payment);
      const source = accounts.get(payment.from);
      const target = accounts.get(payment.to);
      if (target.balance < payment.amount) return send(422, { error: 'INSUFFICIENT_REFUND_FUNDS' });
      if (!Number.isSafeInteger(source.balance + payment.amount)) return send(422, { error: 'BALANCE_OVERFLOW' });
      target.balance -= payment.amount;
      source.balance += payment.amount;
      payment.status = 'REFUNDED';
      return send(200, payment);
    }
    if (req.method === 'GET' && /^\/payments\/[^/]+$/.test(path)) {
      const payment = payments.get(path.split('/')[2]);
      return payment ? send(200, payment) : send(404, { error: 'PAYMENT_NOT_FOUND' });
    }
    return send(404, { error: 'NOT_FOUND' });
  });
  return server;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, '127.0.0.1', () => console.log(`Payment Lab: http://127.0.0.1:${port}`));
}
module.exports = { createServer };
