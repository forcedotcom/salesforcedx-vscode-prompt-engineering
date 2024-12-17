import * as vscode from 'vscode';
import { ServiceProvider, ServiceType, AiApiClient, CommandSource, processGeneration } from '@salesforce/vscode-service-provider';
import * as fs from 'fs';
import * as YAML from 'yaml';

export const sendYamlPromptToLLM = async (): Promise<void> => {
  console.log('This is the sendYamlPromptToLLM() method');
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    // notificationService.showErrorMessage('No active editor detected');
    throw Error('No active editor detected');
  }

  const editorView = editor.document;
  const editorText = editorView.getText();

  console.log('document text = ' + editorText);
  const promptYaml = YAML.parse(editorText);

  const experimentId = promptYaml.experiment;
  const systemPrompt = promptYaml.systemPrompt.replace(/\\`/g, "`");
  const userPrompt = promptYaml.userPrompt;
  const context = promptYaml.context;
  console.log('inside sendYamlPromptToLLM() - context = ' + context);

  const documentContents = await callLLM(systemPrompt, userPrompt, context);

  console.log('documentContents = ~' + documentContents + '~');

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const formattedDate = `${month}${day}${year}_${hours}:${minutes}:${seconds}`;

  let documentContentsFileName = `documentContents_${experimentId}_${formattedDate}.yaml`;
  fs.writeFileSync(documentContentsFileName, documentContents);
}

export const getAiApiClient = async (): Promise<AiApiClient> => {
  return ServiceProvider.getService(ServiceType.AiApiClient);
};

const callLLM = async (systemPrompt: string, userPrompt: string, context: any): Promise<string> => {
  console.log('inside callLLM() - context = ' + context);
  console.log('inside callLLM() - context.length = ' + context.length);

  const systemTag = '<|system|>';
  const endOfPromptTag = '<|endofprompt|>';
  const userTag = '<|user|>';
  const assistantTag = '<|assistant|>';

  let input =
  `${systemTag}\n${systemPrompt}${endOfPromptTag}\n${userTag}\n` +
  userPrompt + '\n';

  for (let i = 0; i < context.length; i++) {
    console.log('JSON.stringify(context[i]) = ' + JSON.stringify(context[i]));
    const contextName = "context" + (i + 1);
    console.log('JSON.stringify(context[i][contextName]text) = ' + context[i][contextName].text);
    console.log('JSON.stringify(context[i].contextName.context) = ' + context[i][contextName].context);
    input += (context[i][contextName].text + '\n' + context[i][contextName].context);
  }

  input +=
  `${endOfPromptTag}\n${assistantTag}`;
  console.log('input = ' + input);

  // // Replace all occurrences of "\`" with "`"
  // input = input.replace(/\\`/g, "`");

  // let input = "This is a test string with \\`backticks\\`.";
  // console.log('original input = ' + input);
  // input = input.replace(/\\`/g, "`");

  // console.log('new input = ' + input); // This is a test string with `backticks`.

  const apiClient = await getAiApiClient();

  const chatRequestBody = {
    prompt: input,
    stop_sequences: ['<|endofprompt|>'],
    max_tokens: 2048, // Adjust the max_tokens as needed
    parameters: {
      command_source: CommandSource.Chat
    }
  };
  console.log('chatRequestBody = ' + JSON.stringify(chatRequestBody));
  const apiClientStream = await apiClient.getChatStream(chatRequestBody, 'generateOpenAPIv3Specifications');
  console.log('apiClientStream = ' + JSON.stringify(apiClientStream));

  let documentContents = '';
  for await (const chunk of apiClientStream) {
    const { done, text } = processGeneration(chunk);
    documentContents += text;

    if (done) {
      break;
    }
  }
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
}
