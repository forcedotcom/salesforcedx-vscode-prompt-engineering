import { LLMServiceInterface, ServiceProvider, ServiceType } from '@salesforce/vscode-service-provider';

/**
 * Retrieves the LLM (Large Language Model) service interface.
 *
 * This function asynchronously fetches the LLM service interface from the service provider
 * using the specified service type and extension name.
 *
 * @returns {Promise<LLMServiceInterface>} A promise that resolves to the LLM service interface.
 */
export const getLLMServiceInterface = async (): Promise<LLMServiceInterface> => {
  return ServiceProvider.getService(ServiceType.LLMService, 'salesforcedx-vscode-prompt-engineering');
};

export const normalizeText = (text: string): string => {
  return text
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.length > 0)
    .join('\n');
};

export const cleanupYaml = (yaml: string): string => {
  // Remove the Markdown code block formatting
  const index = yaml.indexOf('openapi');
  console.log('Index of "openapi" in documentContents:', index);
  if (index === -1) {
    console.log('Could not find "openapi" in documentContents');
    throw 'An OpenAPI v3 specification cannot be generated for this Apex class.';
  }
  return yaml
    .substring(index)
    .split('\n')
    .filter(line => !/^```$/.test(line))
    .join('\n');
};
