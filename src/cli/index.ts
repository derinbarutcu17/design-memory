#!/usr/bin/env node
import { Command } from 'commander';
import { runAudit } from '../lib/audit';
import { scanPullRequest } from '../lib/audit';
import { installHook } from './install';
import { ghostConfig } from './ghost';

export const program = new Command();

program
  .name('design-memory')
  .description('Enforce design constraints at the Git hook level.')
  .version('0.1.0');

export const auditCommand = program
  .command('audit')
  .description('Runs the check manually on staged files')
  .action(async () => {
    try {
      await runAudit();
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

export const initCommand = program
  .command('init')
  .description('Installs the Git hook')
  .action(async () => {
    try {
      await installHook();
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

export const ghostCommand = program
  .command('ghost')
  .description('IDE Ghost Configuration (Prompt Injection)')
  .action(async () => {
    try {
      await ghostConfig();
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

export const scanCommand = program
  .command('scan')
  .description('Runs a non-blocking audit against a GitHub pull request')
  .requiredOption('--pr <number>', 'Pull request number to scan')
  .action(async ({ pr }: { pr: string }) => {
    try {
      await scanPullRequest(Number(pr));
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse(process.argv);
