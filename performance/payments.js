import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';

const businessFailures = new Rate('business_failures');
const base = __ENV.BASE_URL || 'http://127.0.0.1:3000';
export const options = {
  scenarios: {
    payments: {
      executor: 'constant-arrival-rate',
      rate: 10, timeUnit: '1s', duration: '30s',
      preAllocatedVUs: 5, maxVUs: 20,
    },
  },
  thresholds: {
    'http_req_duration{operation:payment}': ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
    business_failures: ['rate==0'],
    dropped_iterations: ['count==0'],
  },
};

export function setup() {
  return { runId: `${Date.now()}-${Math.random().toString(16).slice(2)}` };
}

export default function (data) {
  const params = { headers: { 'Content-Type': 'application/json' }, tags: { operation: 'setup' } };
  const source = http.post(`${base}/accounts`, JSON.stringify({ balance: 10000 }), params);
  const target = http.post(`${base}/accounts`, JSON.stringify({ balance: 0 }), params);
  if (source.status !== 201 || target.status !== 201) {
    businessFailures.add(true);
    return;
  }
  const body = JSON.stringify({ from: source.json('id'), to: target.json('id'), amount: 100 });
  const response = http.post(`${base}/payments`, body, {
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `${data.runId}-${__VU}-${__ITER}` },
    tags: { operation: 'payment' },
  });
  const valid = check(response, {
    'pagamento aprovado': (r) => r.status === 201,
    'valor e estado corretos': (r) => {
      try { return r.json('amount') === 100 && r.json('status') === 'APPROVED'; }
      catch { return false; }
    },
  });
  businessFailures.add(!valid);
}
