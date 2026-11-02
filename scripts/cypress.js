const { spawn } = require('node:child_process');
const path = require('node:path');
const manifest = require('cypress/package.json');
const cli = path.resolve(path.dirname(require.resolve('cypress/package.json')), manifest.bin.cypress);

// Alguns editores exportam esta variável para seus próprios processos Electron.
// O navegador Cypress precisa iniciar como Electron, não como um processo Node.
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
});
child.on('error', (error) => {
  console.error(`Não foi possível iniciar o Cypress: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code) => { process.exitCode = code ?? 1; });
