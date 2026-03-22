import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { DEFAULT_CONFIG, type DesignMemoryConfig } from '../src/lib/config';
import { saveReferenceSnapshot } from '../src/lib/state';
import type { ReferenceSnapshot } from '../src/lib/types';

type ConfigOverrides = Partial<DesignMemoryConfig> & {
  reference?: Partial<DesignMemoryConfig['reference']>;
  rules?: Partial<DesignMemoryConfig['rules']>;
  baseline?: Partial<DesignMemoryConfig['baseline']>;
  llmFallback?: Partial<DesignMemoryConfig['llmFallback']>;
  ai?: Partial<DesignMemoryConfig['ai']>;
};

export function makeTempDir(prefix = 'design-memory-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function makeRepoRoot(prefix = 'design-memory-repo-') {
  const cwd = makeTempDir(prefix);
  fs.mkdirSync(path.join(cwd, '.git', 'hooks'), { recursive: true });
  return cwd;
}

export function writeConfig(cwd: string, overrides: ConfigOverrides = {}) {
  const config: DesignMemoryConfig = {
    ...DEFAULT_CONFIG,
    ...overrides,
    reference: {
      ...DEFAULT_CONFIG.reference,
      ...overrides.reference,
    },
    rules: {
      ...DEFAULT_CONFIG.rules,
      ...overrides.rules,
    },
    baseline: {
      ...DEFAULT_CONFIG.baseline,
      ...overrides.baseline,
    },
    llmFallback: {
      ...DEFAULT_CONFIG.llmFallback,
      ...overrides.llmFallback,
    },
    ai: {
      ...DEFAULT_CONFIG.ai,
      ...overrides.ai,
    },
  };

  fs.writeFileSync(path.join(cwd, 'design-memory.config.json'), `${JSON.stringify(config, null, 2)}\n`);
  return config;
}

export function writeSnapshot(cwd: string, snapshot?: ReferenceSnapshot) {
  const resolvedSnapshot: ReferenceSnapshot = snapshot ?? {
    metadata: {
      source: 'stitch-design-md',
      versionLabel: 'Test snapshot',
      importedAt: new Date().toISOString(),
      tokenCount: 1,
      componentCount: 1,
    },
    tokens: [
      {
        name: 'color.button.primary',
        kind: 'color',
        value: '#00ff00',
        aliases: ['primary', 'button-primary'],
        codeHints: ['bg-primary', 'text-primary'],
      },
    ],
    components: [
      {
        name: 'Button',
        codeMatches: ['Button'],
        aliases: ['Button'],
        requiredPatterns: ['bg-primary'],
        disallowedPatterns: ['style={{'],
        states: [{ name: 'hover' }],
        variants: [{ name: 'primary' }],
        tokensUsed: ['color.button.primary'],
      },
    ],
    aliasMap: {
      'color.button.primary': ['primary', 'bg-primary', 'text-primary'],
    },
  };

  saveReferenceSnapshot(resolvedSnapshot, cwd);
  return resolvedSnapshot;
}
