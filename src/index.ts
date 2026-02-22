import { Command } from 'commander';
import { version } from './version';
import { setDebugMode } from './core/logger';
import { loginCommand } from './commands/login';
import { logoutCommand } from './commands/logout';
import { statusCommand } from './commands/status';
import { quotaCommand } from './commands/quota';
import { accountsCommand } from './commands/accounts';
import { doctorCommand } from './commands/doctor';

const program = new Command();

program
  .name('antigravity-quota')
  .description('CLI tool to check Antigravity model quota via Google Cloud API')
  .version(version)
  .option('--debug', 'Enable debug mode')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.debug) {
      setDebugMode(true);
    }
  });

program
  .command('login')
  .description('Authenticate with Google (adds a new account)')
  .option('--no-browser', 'Do not open a browser, print URL instead')
  .option('-p --port <port>', 'Port for OAuth callback server', parseInt)
  .action(loginCommand);

program
  .command('logout [email]')
  .description('Remove stored credentials')
  .action((email, options) => {
    logoutCommand(options, email);
  });

program
  .command('status')
  .description('Show current authentication status')
  .option('--all', 'Show status for all accounts')
  .option('-a, --account <email>', 'Show status for specific account')
  .action(statusCommand);

program
  .command('quota', { isDefault: true })
  .description('Fetch and display quota information')
  .option('--json', 'Output as JSON')
  .option(
    '-m, --method <method>',
    'Method to use: auto (default), local, or google',
    'auto',
  )
  .option('--all', 'Show quota for all accounts')
  .option('-a, --account <email>', 'Show quota for specific account')
  .option('--refresh', 'Force refresh (skip cache)')
  .action(quotaCommand);

const accountsCmd = program
  .command('accounts')
  .description('Manage multiple accounts');

accountsCmd
  .command('list')
  .description('List all accounts')
  .option('--refresh', 'Show refresh tip')
  .action((options) => accountsCommand('list', [], options));

accountsCmd
  .command('add')
  .description('Add a new account (triggers OAuth login)')
  .action(() => accountsCommand('add', [], {}));

accountsCmd
  .command('switch <email>')
  .description('Switch to a different account')
  .action((email) => accountsCommand('switch', [email], {}));

accountsCmd
  .command('current')
  .description('Show current account')
  .action(() => accountsCommand('current', [], {}));

accountsCmd
  .command('refresh [email]')
  .description('Refresh account tokens')
  .option('--all', 'Refresh all accounts')
  .action((email, options) =>
    accountsCommand('refresh', email ? [email] : [], options),
  );

program
  .command('doctor')
  .description('Run diagnostics and configuration')
  .action(doctorCommand);

program.parse();
