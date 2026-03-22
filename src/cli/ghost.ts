import fs from 'fs';
import path from 'path';

export async function ghostConfig() {
  const cwd = process.cwd();
  const rulesFiles = [
    path.join(cwd, '.cursorrules'),
    path.join(cwd, '.windsurfrules'),
    path.join(cwd, '.github', 'copilot-instructions.md'),
  ];

  const injection = `\nDESIGN MEMORY RULE: Before generating or modifying audited UI code, cross-reference the components with the repository design reference. Avoid raw hex colors, arbitrary Tailwind values, and inline styles that bypass the design system.\n`;

  let updated = false;
  for (const file of rulesFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');
      if (!content.includes('DESIGN MEMORY RULE:')) {
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
