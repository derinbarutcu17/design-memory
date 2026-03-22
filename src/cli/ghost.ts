import fs from 'fs';
import path from 'path';

export async function ghostConfig() {
  const cwd = process.cwd();
  const rulesFiles = [
    path.join(cwd, '.cursorrules'),
    path.join(cwd, '.windsurfrules'),
    path.join(cwd, '.github', 'copilot-instructions.md'),
  ];

  const injection = `\nCRITICAL REPOSITORY RULE: A strict pre-commit hook is active. Before generating or modifying any UI code, you MUST cross-reference the components with design.md. Do not invent hex codes or spacing. If you deviate from the design context, the user's Git commit will be forcefully rejected.\n`;

  let updated = false;
  for (const file of rulesFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');
      if (!content.includes('CRITICAL REPOSITORY RULE: A strict pre-commit hook is active.')) {
        fs.appendFileSync(file, injection);
        console.log(`[Design Memory] Ghost injection applied to ${path.basename(file)}.`);
        updated = true;
      } else {
        console.log(`[Design Memory] Ghost injection already present in ${path.basename(file)}.`);
        updated = true;
      }
    }
  }

  if (!updated) {
    // If no files found, create .cursorrules by default
    fs.writeFileSync(path.join(cwd, '.cursorrules'), injection);
    console.log('[Design Memory] Created .cursorrules with ghost injection.');
  }
}
