import readline from 'node:readline';

/** Print the action, then return true only if the typed line equals the account ID exactly. */
export function confirmAccountChange({ accountId, action, input = process.stdin, output = process.stdout }) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input, output, terminal: false });
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      rl.close();
      resolve(v);
    };
    rl.on('close', () => finish(false));
    output.write(`About to change account ${accountId}: ${action}\nType the account ID to confirm: `);
    rl.once('line', (line) => finish(line.trim() === accountId));
  });
}
