import { Command } from 'commander';
import { version } from './version';
import { setDebugMode } from './core/logger';
import { loginCommand } from './commands/login';
import { logoutCommand } from './commands/logout';
import { statusCommand } from './commands/status';

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

program.parse();
