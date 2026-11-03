# Evidências de validação

## Ampliação dos cenários — 03/11/2026

Ambiente: macOS arm64, Node.js 22.23.3, Cypress 15.21.1, Electron 138.

| Verificação | Resultado |
| --- | --- |
| `CYPRESS_BASE_URL=http://127.0.0.1:3001 npm run cy:run` | 19 testes aprovados, nenhuma falha ou teste ignorado |
| `npm test` | 1 teste de concorrência aprovado |
| k6 | Não executado nesta etapa |

A API desta execução foi iniciada com `PORT=3001 npm start` para usar uma instância nova sem interromper a porta 3000. A configuração padrão continua na porta 3000.

Os nove novos testes cobrem origem e destino inexistentes, pagamento para a mesma conta, chave ausente, saldo exato, estorno sem saldo suficiente, JSON malformado, valor acima do inteiro seguro e repetição após estorno. Verificam respostas e preservação ou movimentação esperada dos saldos. O estorno rejeitado também preserva o estado APPROVED e os saldos das três contas envolvidas.

Não foi necessário alterar a API: os cenários passaram com a implementação existente. Esta cobertura não inclui falhas distribuídas, persistência ou autorização.

## Validação inicial — 02/11/2026

Ambiente: macOS arm64, Node.js 22.23.3, Cypress 15.21.1, Electron 138.

| Verificação | Resultado |
| --- | --- |
| `npm test` | 1 teste aprovado, cobrindo duplicidade e disputa de saldo com requisições concorrentes |
| `env -u ELECTRON_RUN_AS_NODE npm run cy:run` | 10 testes aprovados, nenhuma falha |
| k6 | Não executado: binário não instalado no ambiente |
| GitHub Actions | Configurado; ainda não executado no GitHub |

A primeira tentativa de Cypress falhou porque o editor definiu `ELECTRON_RUN_AS_NODE=1`. A execução sem essa variável passou. A API precisou de permissão do ambiente para abrir uma porta localhost.

Os tempos do runner Cypress não são métricas de capacidade da API. Não há resultado de carga ou SLA validado nesta execução.
