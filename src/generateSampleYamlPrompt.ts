import * as fs from 'fs';
import { SAMPLE_YAML_PROMPT } from './constants';

/**
 * Creates a YAML file containing a sample prompt.
 *
 * @param filename The name of the prompt YAML file to create.
 */
export const generateSampleYamlPrompt = async (filename: string): Promise<void> => {
  console.log('This is the generateSampleYamlPrompt() method');
  fs.writeFileSync(filename, SAMPLE_YAML_PROMPT);
}
