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

  for (const missing of ['from', 'to']) {
    it(`rejeita conta de ${missing === 'from' ? 'origem' : 'destino'} inexistente sem movimentar dinheiro`, () => {
      pay({ from, to, amount: 2500, [missing]: crypto.randomUUID() }, key).then(({ status, body }) => {
        expect(status).to.eq(404);
        expect(body.error).to.eq('ACCOUNT_NOT_FOUND');
      });
      balance(from, 10000);
      balance(to, 0);
    });
  }

  it('rejeita pagamento para a própria conta', () => {
    pay({ from, to: from, amount: 2500 }, key).then(({ status, body }) => {
      expect(status).to.eq(422);
      expect(body.error).to.eq('SAME_ACCOUNT');
    });
    balance(from, 10000);
    balance(to, 0);
  });

  it('exige chave de idempotência antes de movimentar dinheiro', () => {
    cy.request({
      method: 'POST', url: '/payments', body: { from, to, amount: 2500 }, failOnStatusCode: false,
    }).then(({ status, body }) => {
      expect(status).to.eq(400);
      expect(body.error).to.eq('INVALID_IDEMPOTENCY_KEY');
    });
    balance(from, 10000);
    balance(to, 0);
  });

  it('aprova pagamento do saldo exato e zera a origem', () => {
    pay({ from, to, amount: 10000 }, key).then(({ status, body }) => {
      expect(status).to.eq(201);
      expect(body).to.include({ from, to, amount: 10000, status: 'APPROVED' });
      cy.request(`/payments/${body.id}`).its('body').should('deep.equal', body);
    });
    balance(from, 0);
    balance(to, 10000);
  });

  it('rejeita estorno se o destinatário gastou o saldo, sem devolução parcial', () => {
    cy.request('POST', '/accounts', { balance: 0 }).then(({ body: third }) => {
      pay({ from, to, amount: 2500 }, key).then(({ body: payment }) => {
        pay({ from: to, to: third.id, amount: 1000 }, crypto.randomUUID()).its('status').should('eq', 201);
        cy.request({
          method: 'POST', url: `/payments/${payment.id}/refund`, body: {}, failOnStatusCode: false,
        }).then(({ status, body }) => {
          expect(status).to.eq(422);
          expect(body.error).to.eq('INSUFFICIENT_REFUND_FUNDS');
        });
        cy.request(`/payments/${payment.id}`).its('body').should('deep.equal', payment);
        balance(from, 7500);
        balance(to, 1500);
        balance(third.id, 1000);
      });
    });
  });

  it('rejeita JSON malformado sem movimentação e mantém a API disponível', () => {
    cy.request({
      method: 'POST', url: '/payments', body: '{"amount":',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      failOnStatusCode: false,
    }).then(({ status, body }) => {
      expect(status).to.eq(400);
      expect(body.error).to.eq('INVALID_JSON');
    });
    balance(from, 10000);
    balance(to, 0);
    cy.request('/health').its('body.status').should('eq', 'ok');
  });

  it('rejeita valor acima do maior inteiro seguro', () => {
    pay({ from, to, amount: Number.MAX_SAFE_INTEGER + 1 }, key).then(({ status, body }) => {
      expect(status).to.eq(422);
      expect(body.error).to.eq('INVALID_AMOUNT');
    });
    balance(from, 10000);
    balance(to, 0);
  });

  it('repete pagamento após estorno sem criar novo débito e retorna o estado atual', () => {
    pay({ from, to, amount: 2500 }, key).then(({ body: payment }) => {
      cy.request('POST', `/payments/${payment.id}/refund`, {}).then(({ status, body: refunded }) => {
        expect(status).to.eq(200);
        expect(refunded).to.include({ id: payment.id, status: 'REFUNDED' });
        pay({ from, to, amount: 2500 }, key).then(({ status: replayStatus, body }) => {
          expect(replayStatus).to.eq(200);
          expect(body).to.deep.equal(refunded);
        });
        cy.request(`/payments/${payment.id}`).its('body').should('deep.equal', refunded);
      });
    });
    balance(from, 10000);
    balance(to, 0);
  });
});
