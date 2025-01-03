import * as vscode from 'vscode';
import { ServiceProvider, ServiceType, LLMServiceInterface } from '@salesforce/vscode-service-provider';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Reads a YAML file containing the prompt components.
 * Calls buildPromptAndCallLLM() to send the prompt to the XGen LLM.
 * Writes the response to a file.
 *
 * @throws Will throw an error if there is no active editor.
 */
export const sendRawPromptToLLM = async (): Promise<void> => {
  console.log('This is the sendRawPromptToLLM() method');

  try {
    // Show running notification to the user
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'SFDX: Send Raw Prompt in Current File to LLM',
        cancellable: false
      },
      async progress => {
        progress.report({ message: 'Running...' });

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          throw Error('No active editor detected');
        }

        const editorFilename = path.parse(editor.document.fileName).name;
        const editorView = editor.document;
        const editorText = editorView.getText();

        console.log('document text = ' + editorText);

        const documentContents = await buildPromptAndCallLLM(editorText);

        console.log('documentContents = ~' + documentContents + '~');

        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const formattedDate = `${month}${day}${year}_${hours}:${minutes}:${seconds}`;

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
          throw new Error('No workspace folder is open');
        }
        const rootPath = workspaceFolders[0].uri.fsPath;

        const resultsDir = path.join(rootPath, 'results');
        if (!fs.existsSync(resultsDir)) {
          fs.mkdirSync(resultsDir);
        }

        const documentContentsFileName = path.join(
          resultsDir,
          `rawPrompt_${editorFilename}_${formattedDate}.yaml`
        );
        console.log('documentContentsFileName = ' + documentContentsFileName);
        fs.writeFileSync(documentContentsFileName, documentContents);
      }
    );

    // Show success notification to the user
    vscode.window.showInformationMessage(
      'SFDX: Send Raw Prompt in Current File to LLM command completed successfully.'
    );
  } catch (error) {
    // Show failure notification to the user
    vscode.window.showErrorMessage('SFDX: Send Raw Prompt in Current File to LLM command failed: ' + error.message);
  }
};

/**
 * Builds the prompt in the format expected by the XGen LLM.
 * Sends the prompt to the XGen LLM.
 * Parses the response to only include the OpenAPI v3 specification.
 *
 * @param systemPrompt The grounding prompt.
 * @param userPrompt The dynamic prompt that is generated based on the contents of the Apex class which the OpenAPI v3 specification should be generated for.
 * @param context The Apex class that the OpenAPI v3 specification should be generated for, and any additional context.
 * @returns The OpenAPI v3 specification for the Apex class.
 */
const buildPromptAndCallLLM = async (rawPrompt: string): Promise<string> => {

  console.log('raw prompt = ' + rawPrompt);
  // Initialize the LLM service interface, then call the LLM service with the constructed input and get the response
  const llmService = await getLLMServiceInterface();
  let documentContents = await llmService.callLLM(rawPrompt);

  console.log('--- documentContents = ' + documentContents);

  // Remove the Markdown code block formatting
  const index = documentContents.indexOf('openapi');
  console.log('Index of "openapi" in documentContents:', index);
  if (index !== -1) {
    documentContents = documentContents.substring(index);
  } else {
    console.log('Could not find "openapi" in documentContents');
    return 'An OpenAPI v3 specification cannot be generated for this Apex class.';
  }
  documentContents = documentContents.replace(/```$/, '');

  return documentContents;
};

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

const normalizeText = (text: string): string => {
  return text
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.length > 0)
    .join('\n');
};
