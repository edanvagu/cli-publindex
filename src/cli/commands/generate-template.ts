import { generateTemplate } from '../../io/excel-writer';

export async function runGenerateTemplate(): Promise<void> {
  await generateTemplate();
}
