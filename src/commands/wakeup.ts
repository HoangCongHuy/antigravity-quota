import { debug, info } from '../core/logger';

type WakeupSubcommand =
  | 'config'
  | 'trigger'
  | 'install'
  | 'uninstall'
  | 'test'
  | 'history'
  | 'status';

interface WakeupOptions {
  scheduled?: boolean;
  limit?: string;
  json?: boolean;
}

export async function wakeupCommand(
  subcommand: WakeupSubcommand,
  options: WakeupOptions,
): Promise<void> {
  debug('wakeup', `Subcommand: ${subcommand}, options: `, options);

  switch (subcommand) {
    case 'config':
      await configureWakeup();
      break;
    case 'trigger':
      await runScheduledTrigger(options.scheduled ?? false);
      break;
    case 'install':
      await installSchedule();
      break;
    case 'uninstall':
      await uninstallSchedule();
      break;
    case 'test':
      runTestTrigger();
      break;
    case 'history':
      await showHistory(options);
      break;
    case 'status':
    default:
      await showStatus();
      break;
  }
}

async function configureWakeup(): Promise<void> {
  info('\n🔧 Auto Wake-up Configuration\n');
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;

  return `${Math.floor(seconds / 86400)} days ago`;
}
