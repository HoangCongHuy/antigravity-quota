import { Command } from 'commander';
import { version } from './version';
import { setDebugMode } from './core/logger';
import { loginCommand } from './commands/login';

const program = new Command();

program
  .name('antigravity-quota')
  .description('CLI tool to check Antigravity model quota via Google Cloud API')
  .version(version)
  .option('--debug', 'Enable debug mode')
  .hook('preAction', (thisCommand, actionCommand) => {
    const opts = thisCommand.opts();
    if (opts.debug) {
      setDebugMode(true);
    }
  });

program
  .name('login')
  .command('login')
  .description('Authenticate with Google (adds a new account)')
  .option('--no-browser', 'Do not open a browser, print URL instead')
  .option('-p --port <port>', 'Port for OAuth callback server', parseInt)
  .action(loginCommand);
