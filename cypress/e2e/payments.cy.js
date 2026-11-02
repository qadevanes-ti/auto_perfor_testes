describe('Qualidade de pagamentos', () => {
  let from;
  let to;
  let key;
  const pay = (body, idempotencyKey) => cy.request({
    method: 'POST', url: '/payments', body,
    headers: { 'Idempotency-Key': idempotencyKey }, failOnStatusCode: false,
  });
  const balance = (id, expected) => cy.request(`/accounts/${id}`).its('body.balance').should('eq', expected);

  beforeEach(() => {
    key = crypto.randomUUID();
    cy.request('POST', '/accounts', { balance: 10000 }).then(({ body }) => { from = body.id; });
    cy.request('POST', '/accounts', { balance: 0 }).then(({ body }) => { to = body.id; });
  });

  it('transfere o valor exato e permite consultar o pagamento', () => {
    pay({ from, to, amount: 2500 }, key).then(({ status, body }) => {
      expect(status).to.eq(201);
      expect(body).to.include({ from, to, amount: 2500, status: 'APPROVED' });
      cy.request(`/payments/${body.id}`).its('body').should('deep.equal', body);
    });
    balance(from, 7500);
    balance(to, 2500);
  });

  it('repete a requisição sem movimentar o dinheiro novamente', () => {
    pay({ from, to, amount: 2500 }, key).then((first) => {
      pay({ from, to, amount: 2500 }, key).then((second) => {
        expect(second.status).to.eq(200);
        expect(second.body.id).to.eq(first.body.id);
      });
    });
    balance(from, 7500);
    balance(to, 2500);
  });

  it('rejeita reutilização da chave com outro valor', () => {
    pay({ from, to, amount: 2500 }, key);
    pay({ from, to, amount: 3000 }, key).then(({ status, body }) => {
      expect(status).to.eq(409);
      expect(body.error).to.eq('IDEMPOTENCY_CONFLICT');
    });
    balance(from, 7500);
    balance(to, 2500);
  });

  for (const amount of [0, -1, 1.5, '100', null, 10001]) {
    it(`rejeita valor inválido ou saldo insuficiente: ${JSON.stringify(amount)}`, () => {
      pay({ from, to, amount }, key).then(({ status, body }) => {
        expect(status).to.eq(422);
        expect(body.error).to.eq(amount === 10001 ? 'INSUFFICIENT_FUNDS' : 'INVALID_AMOUNT');
      });
      balance(from, 10000);
      balance(to, 0);
    });
  }

  it('estorna uma única vez mesmo com repetição', () => {
    pay({ from, to, amount: 2500 }, key).then(({ body }) => {
      cy.request('POST', `/payments/${body.id}/refund`, {}).its('body.status').should('eq', 'REFUNDED');
      cy.request('POST', `/payments/${body.id}/refund`, {}).its('body.status').should('eq', 'REFUNDED');
    });
    balance(from, 10000);
    balance(to, 0);
  });
});
