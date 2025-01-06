import * as vscode from 'vscode';
import * as fs from 'fs';
import * as YAML from 'yaml';
import * as path from 'path';
import { cleanupYaml, getLLMServiceInterface, normalizeText, addTabToEachLine } from './utilities';

/**
 * Reads a YAML file containing the prompt components.
 * Calls buildPromptAndCallLLM() to send the prompt to the XGen LLM.
 * Writes the response to a file.
 *
 * @throws Will throw an error if there is no active editor.
 */
export const sendYamlPromptToLLM = async (): Promise<void> => {
  console.log('This is the sendYamlPromptToLLM() method');

  try {
    // Show running notification to the user
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'SFDX: Send Prompt in Current YAML File to LLM',
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
        const promptYaml = YAML.parse(editorText);

        const systemPrompt = promptYaml.experiment.system_prompt;
        const userPrompt = promptYaml.experiment.user_prompt;
        const context = promptYaml.experiment.context;
        console.log('inside sendYamlPromptToLLM() - systemPrompt = ' + systemPrompt);
        console.log('inside sendYamlPromptToLLM() - userPrompt = ' + userPrompt);
        console.log('inside sendYamlPromptToLLM() - context = ' + JSON.stringify(context));

        const documentContents = await buildPromptAndCallLLM(systemPrompt, userPrompt, context);
        const returnValue = `prompt: |\n${addTabToEachLine(documentContents[0])}\n\n${documentContents[1]}\n\nideal_solution:\n${addTabToEachLine(YAML.stringify(promptYaml.ideal_solution))}`;

        console.log('returnValue = ~' + returnValue + '~');

        const yamlDoc = YAML.parseDocument(documentContents[1]);

        if (!yamlDoc) {
          throw Error('documentContents[1] is not a valid YAML document');
        }

        const errors = yamlDoc.errors;

        if (errors.length > 0) {
          progress.report({message: `Generated YAML document has syntax errors: ${errors}`});
        }

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
          `documentContents_${editorFilename}_${formattedDate}.yaml`
        );
        console.log('documentContentsFileName = ' + documentContentsFileName);
        fs.writeFileSync(documentContentsFileName, returnValue);
      }
    );

    // Show success notification to the user
    vscode.window.showInformationMessage(
      'SFDX: Send Prompt in Current YAML File to LLM command completed successfully.'
    );
  } catch (error) {
    // Show failure notification to the user
    vscode.window.showErrorMessage('SFDX: Send Prompt in Current YAML File to LLM command failed: ' + error.message);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buildPromptAndCallLLM = async (systemPrompt: string, userPrompt: string, context: any): Promise<string[]> => {
  console.log('inside buildPromptAndCallLLM() - context = ' + context);
  console.log('inside buildPromptAndCallLLM() - context.length = ' + context.length);

  // Construct the input prompt to be sent to the LLM
  const systemTag = '<|system|>';
  const endOfPromptTag = '<|endofprompt|>';
  const userTag = '<|user|>';
  const assistantTag = '<|assistant|>';

  let input =
    `${systemTag}\n${normalizeText(systemPrompt)}\n${endOfPromptTag}\n${userTag}\n` + normalizeText(userPrompt) + '\n';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input += context.reduce((acc: string, curr: any, index: number) => {
    const contextName = 'context' + (index + 1);
  if (curr[contextName]) {
    return acc + (normalizeText(curr[contextName].text) + '\n' + normalizeText(curr[contextName].context));
  } else {
    throw Error('Context is missing');
  }
}, '');

  // strip empty lines and remove trailing whitespace
  input = normalizeText(input);
  // the trailing newline is required by the LLM
  input += `\n${endOfPromptTag}\n${assistantTag}\n`;
  console.log('input = ' + input);

  // Initialize the LLM service interface, then call the LLM service with the constructed input and get the response
  const llmService = await getLLMServiceInterface();
  const llmResult = await llmService.callLLM(input);

  console.log('--- llmResult = ' + llmResult);

  return [input, cleanupYaml(llmResult)];
};
