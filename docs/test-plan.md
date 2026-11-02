# Estratégia de testes

Objetivo: detectar perda, criação ou movimentação duplicada de dinheiro e rejeições incorretas. Priorize integridade financeira antes de medir velocidade.

| Risco / cenário | Resultado esperado | Automação atual |
| --- | --- | --- |
| Pagamento válido | Débito e crédito exatos; consulta consistente | Cypress |
| Repetição da chave | Mesmo ID; um único débito | Cypress + Node concorrente |
| Chave com outro valor | 409; saldos preservados após primeiro pagamento | Cypress |
| Valor zero, negativo, fracionário, string ou nulo | 422; sem movimentação | Cypress |
| Saldo insuficiente | 422; saldos preservados | Cypress |
| Estorno repetido | Dinheiro devolvido uma única vez | Cypress |
| Disputa pelo último saldo | Sem saldo negativo; soma dos saldos preservada | Node concorrente |
| Carga constante | Latência e erros dentro dos critérios didáticos | k6, execução pendente |
| Conta inexistente | 404; nenhuma movimentação | Exercício pendente |
| Pagamento para a mesma conta | 422; saldo preservado | Exercício pendente |
| Chave ausente | 400; nenhuma movimentação | Exercício pendente |
| Saldo exatamente igual ao valor | Aprovação; origem zerada | Exercício pendente |
| Destinatário gastou antes do estorno | Estorno rejeitado; nenhum efeito parcial | Exercício pendente |
| JSON malformado e valor acima de inteiro seguro | Rejeição controlada | Exercício pendente |
| Repetição após estorno | Mesmo ID com estado REFUNDED; sem novo débito | Exercício pendente |

## Evidência para portfólio

Crie um relatório por execução relevante com commit/versão, ambiente, comando, resultado, falhas e limitações. Para performance registre carga oferecida, carga atingida, p50/p95/p99, erros HTTP, erros de negócio e iterações descartadas.

Um relato de defeito deve ter: regra violada, dados usados, passos, resultado esperado, observado e evidência. Evite somente prints verdes: mostre uma falha detectada, a causa e a correção.

Os testes da API simulada não substituem testes contra uma integração real. Os cenários pendentes são exercícios e não fazem parte da cobertura automatizada atual.
