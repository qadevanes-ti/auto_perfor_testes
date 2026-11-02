# Validação inicial — 02/11/2026

Ambiente: macOS arm64, Node.js 22.23.3, Cypress 15.21.1, Electron 138.

| Verificação | Resultado |
| --- | --- |
| `npm test` | 1 teste aprovado, cobrindo duplicidade e disputa de saldo com requisições concorrentes |
| `env -u ELECTRON_RUN_AS_NODE npm run cy:run` | 10 testes aprovados, nenhuma falha |
| k6 | Não executado: binário não instalado no ambiente |
| GitHub Actions | Configurado; ainda não executado no GitHub |

A primeira tentativa de Cypress falhou porque o editor definiu `ELECTRON_RUN_AS_NODE=1`. A execução sem essa variável passou. A API precisou de permissão do ambiente para abrir uma porta localhost.

Os tempos do runner Cypress não são métricas de capacidade da API. Não há resultado de carga ou SLA validado nesta execução.
