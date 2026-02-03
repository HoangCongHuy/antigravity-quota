import CliTable3 from 'cli-table3';
import { info } from '../core/logger';
import { ModelQuotaInfo, QuotaSnapshot } from './types';

function formatTimeUnitReset(ms?: number): string {
  if (ms === undefined || ms <= 0) {
    return 'N/A';
  }

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function formatRemaining(model: ModelQuotaInfo): string {
  if (model.isExhausted) {
    return '❌ Exhausted';
  }

  if (model.remainingPercentage === undefined) {
    return 'N/A';
  }

  const pct = Math.round(model.remainingPercentage * 100);
  if (pct >= 75) {
    return `🟢 ${pct}%`;
  }

  if (pct >= 50) {
    return `🟡 ${pct}%`;
  }

  if (pct >= 25) {
    return `🟠 ${pct}%`;
  }

  return `🔴 ${pct}%`;
}

export function printQuotaJson(snapshot: QuotaSnapshot): void {
  info(JSON.stringify(snapshot, null, 2));
}

export function printQuotaTable(snapshot: QuotaSnapshot): void {
  const timestamp = new Date(snapshot.timestamp).toLocaleString();
  info('');
  info(`📊 Antigravity Quota Status (via ${snapshot.method.toUpperCase()})`);
  info(`   Retrieved: ${timestamp}`);

  if (snapshot.email || snapshot.planType) {
    const userParts: string[] = [];
    if (snapshot.email) {
      userParts.push(`👤 ${snapshot.email}`);
    }

    if (snapshot.planType) {
      userParts.push(`📋 Plan: ${snapshot.planType}`);
    }

    info(`   ${userParts.join(' | ')}`);
  }

  info('');

  if (snapshot.models.length > 0) {
    const table = new CliTable3({
      head: ['Model', 'Remaining', 'Reset In'],
      style: {
        head: ['cyan'],
        border: ['gray'],
      },
    });

    for (const model of snapshot.models) {
      table.push([
        model.label,
        formatRemaining(model),
        formatTimeUnitReset(model.timeUntilResetMs),
      ]);
    }

    info(table.toString());
  } else {
    info('No model quota information available.');
  }

  info('');
}
