import { resolveReferenceSnapshot } from './context';
import { saveReferenceSnapshot } from './state';

export async function syncReference(cwd = process.cwd()) {
  const snapshot = await resolveReferenceSnapshot(cwd);
  const outputPath = saveReferenceSnapshot(snapshot, cwd);
  return {
    snapshot,
    outputPath,
  };
}
