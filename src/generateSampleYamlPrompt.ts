import * as fs from 'fs';
import { SAMPLE_YAML_PROMPT } from './constants';

export const generateSampleYamlPrompt = async (filename: string): Promise<void> => {
  console.log('This is the generateSampleYamlPrompt() method');
  fs.writeFileSync(filename, SAMPLE_YAML_PROMPT);
}
