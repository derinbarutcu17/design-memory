import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const designMemoryConfigSchema = z.object({
  strictness: z.enum(['warn', 'block']).default('warn'),
  designSource: z.string().default('./DESIGN.md'),
  include: z.array(z.string()).default(['src/components/**/*.tsx', 'src/app/**/*.tsx']),
  exclude: z.array(z.string()).default(['src/lib/**', '**/*.test.tsx', '**/*.test.ts']),
  ai: z.object({
    providerPreference: z.array(z.enum(['local', 'anthropic', 'openai'])).default(['local', 'anthropic', 'openai']),
    maxRetries: z.number().int().min(0).max(3).default(1),
  }).default({
    providerPreference: ['local', 'anthropic', 'openai'],
    maxRetries: 1,
  }),
});

export type DesignMemoryConfig = z.infer<typeof designMemoryConfigSchema>;

export const DEFAULT_CONFIG: DesignMemoryConfig = {
  strictness: 'warn',
  designSource: './DESIGN.md',
  include: ['src/components/**/*.tsx', 'src/app/**/*.tsx'],
  exclude: ['src/lib/**', '**/*.test.tsx', '**/*.test.ts'],
  ai: {
    providerPreference: ['local', 'anthropic', 'openai'],
    maxRetries: 1,
  },
};

export function getConfigPath(cwd = process.cwd()) {
  return path.join(cwd, 'design-memory.config.json');
}

export function readConfig(cwd = process.cwd()): DesignMemoryConfig {
  const configPath = getConfigPath(cwd);
  if (!fs.existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  return designMemoryConfigSchema.parse(raw);
}

export function writeDefaultConfig(cwd = process.cwd()) {
  const configPath = getConfigPath(cwd);
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
  }
  return configPath;
}

function escapeRegex(value: string) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globToRegExp(glob: string) {
  const normalized = glob.replace(/\\/g, '/');
  let pattern = '';
  let index = 0;

  while (index < normalized.length) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (char === '*' && next === '*') {
      const after = normalized[index + 2];
      if (after === '/') {
        pattern += '(?:.*/)?';
        index += 3;
      } else {
        pattern += '.*';
        index += 2;
      }
      continue;
    }

    if (char === '*') {
      pattern += '[^/]*';
      index += 1;
      continue;
    }

    pattern += escapeRegex(char);
    index += 1;
  }

  return new RegExp(`^${pattern}$`);
}

export function matchesGlob(filePath: string, glob: string) {
  return globToRegExp(glob).test(filePath.replace(/\\/g, '/'));
}

export function shouldAuditFile(filePath: string, config: DesignMemoryConfig) {
  const normalized = filePath.replace(/\\/g, '/');
  const included =
    config.include.length === 0 || config.include.some((pattern) => matchesGlob(normalized, pattern));
  const excluded = config.exclude.some((pattern) => matchesGlob(normalized, pattern));
  return included && !excluded;
}
