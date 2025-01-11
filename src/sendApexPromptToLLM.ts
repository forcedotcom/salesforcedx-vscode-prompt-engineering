import * as vscode from 'vscode';
import * as fs from 'fs';
import { DEFAULT_INSTRUCTIONS } from './constants';
import * as path from "path";
import { cleanupYaml, getLLMServiceInterface } from './utilities';

/**
 * Reads the Apex file for which the OpenAPI v3 specification should be generated.
 * Calls buildPromptAndCallLLM() to send the prompt to the XGen LLM.
 * Writes the response to a file.
 *
 * @throws Will throw an error if there is no active editor.
 */
export const sendApexPromptToLLM = async (): Promise<void> => {
  console.log('This is the sendApexPromptToLLM() method');

    try {
      // Show running notification to the user
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'SFDX: Send Prompt in Current Apex File to LLM',
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

          const systemPrompt = `${DEFAULT_INSTRUCTIONS}\n`

          const userPrompt = await constructUserPrompt(editorText);

          const documentContents = await buildPromptAndCallLLM(systemPrompt, userPrompt, [editorText]);

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

          const documentContentsFileName = path.join(resultsDir, `documentContents_${editorFilename}_${formattedDate}.yaml`);
          console.log('documentContentsFileName = ' + documentContentsFileName);
          fs.writeFileSync(documentContentsFileName, documentContents);
        }
      );

      // Show success notification to the user
      vscode.window.showInformationMessage('SFDX: Send Prompt in Current Apex File to LLM command completed successfully.');
    } catch (error) {
      // Show failure notification to the user
      vscode.window.showErrorMessage('SFDX: Send Prompt in Current Apex File to LLM command failed: ' + error.message);
    }
}

/**
 * Builds the prompt in the format expected by the LLM specified in the environment variable.
 * Sends the prompt to the specified LLM.
 * Parses the response to only include the OpenAPI v3 specification.
 *
 * @param systemPrompt The grounding prompt.
 * @param userPrompt The dynamic prompt that is generated based on the contents of the Apex class which the OpenAPI v3 specification should be generated for.
 * @param context The Apex class that the OpenAPI v3 specification should be generated for, and any additional context.
 * @returns The OpenAPI v3 specification for the Apex class.
 */
const buildPromptAndCallLLM = async (systemPrompt: string, userPrompt: string, context: string[]): Promise<string> => {

  const llm = process.env.LLM;
  console.log('llm = ' + llm);

  if (llm === "XGen") {
    // Construct the input prompt to be sent to the XGen LLM
    const systemTag = '<|system|>';
    const endOfPromptTag = '<|endofprompt|>';
    const userTag = '<|user|>';
    const assistantTag = '<|assistant|>';

    let input =
    `${systemTag}\n${systemPrompt}\n${endOfPromptTag}\n${userTag}\n` +
    userPrompt +
    `\nThis is the Apex class the OpenAPI v3 specification should be generated for:\n\`\`\`\n` +
    context[0];

    for (let i = 1; i < context.length; i++) {
      input += `\n\nContext ${i}:\n\`\`\`\n${context[i]}`;
    }

    input +=
    `\n\`\`\`\n${endOfPromptTag}\n${assistantTag}\n`;
    console.log('input = ' + input);

    // Initialize the LLM service interface, then call the LLM service with the constructed input and get the response
    const llmService = await getLLMServiceInterface();
    const documentContents = await llmService.callLLM(input);
    return cleanupYaml(documentContents);
  }

  else if (llm === "OpenAI") {
    return 'OpenAI case';
  }

  return 'This shouldn\'t be reached';
}

/**
 * Constructs the user prompt based on the contents of the Apex class for which the OpenAPI v3 specification needs to be generated.
 *
 * @param editorText The contents of the Apex class.
 * @returns The user prompt.
 */
const constructUserPrompt = async (editorText: string): Promise<string> => {
  let userPrompt = '';

  // if (editorText.includes('@AuraEnabled')) {
  //   userPrompt += 'Only include methods that have the @AuraEnabled annotation in the paths of the OpenAPI v3 specification.\n';
  // }

  // if (editorText.includes('@RestResource')) {
  //   userPrompt += 'Only include methods that have @HttpGet, @HttpPost, @HttpPatch, @HttpPut, or @HttpDelete annotations in the paths of the OpenAPI v3 specification. Unannotated methods are utility methods.\n';
  //   // userPrompt += 'Ignore unannotated methods. They are utility methods.\n';
  //   // userPrompt += 'Method that are not annotated with @HttpGet, @HttpPost, @HttpPatch, @HttpPut, or @HttpDelete should NOT be included in the OpenAPI v3 specification.\n';
  //   // userPrompt += 'Include only the handleMethod() method in the paths of the OpenAPI v3 specification.\n';
  // }

  // For Sample Prompt #6 - this works
  // userPrompt += 'Only include the doDelete(), doGet(), and doPost() methods in the paths of the OpenAPI v3 specification.\n';

  // For Sample Prompt #7 - this does not work
  // userPrompt += 'Only include the handleMethod() method in the paths of the OpenAPI v3 specification. Ignore unannotated methods. They are utility methods.\n';

  // For Sample Prompt #8 - this works
  // userPrompt += 'Only include the getLapstatusCheck(), errorPost(), errorPatch(), errorPut(), and errorDelete() methods in the paths of the OpenAPI v3 specification.\n';

  if (editorText.includes('@HttpGet') || editorText.includes('@HttpDelete')) {
    userPrompt += 'Methods annotated with @HttpGet or @HttpDelete must have no parameters. This is because GET and DELETE requests have no request body, so there\'s nothing to deserialize.\n';
  }

  return userPrompt;
}
