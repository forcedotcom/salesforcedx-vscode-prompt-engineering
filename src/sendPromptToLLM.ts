import * as vscode from 'vscode';
import { ServiceProvider, ServiceType, AiApiClient, CommandSource, processGeneration } from '@salesforce/vscode-service-provider';
import * as fs from 'fs';

export const sendPromptToLLM = async (): Promise<void> => {
  console.log('This is the sendPromptToLLM() method');
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    // notificationService.showErrorMessage('No active editor detected');
    throw Error('No active editor detected');
  }

  const editorView = editor.document;
  const editorText = editorView.getText()
  console.log('document text = ' + editorText);

  const systemPrompt = 'abc';

  const userPrompt = 'Generate an OpenAPI v3 specification for my current Apex class. The OpenAPI v3 specification should be in YAML. The paths should be in the format of /{ClassName}/{MethodName} for the @AuraEnabled methods. When you return Id in a SOQL query, it has `type: Id`. For every `type: object`, generate a `#/components/schemas` entry for that object. The method should have a $ref entry pointing to the generated `#/components/schemas` entry. Only include methods that have the @AuraEnabled annotation in the paths of the OpenAPI v3 specification.'

  const documentContents = await callLLM(systemPrompt, userPrompt, [editorText, 'Context 1', 'Context 2']);

  console.log('documentContents = ~' + documentContents + '~');

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const formattedDate = `${month}${day}${year}_${hours}:${minutes}:${seconds}`;

  let documentContentsFileName = `documentContents_${formattedDate}.yaml`;
  fs.writeFileSync(documentContentsFileName, documentContents);
}

export const getAiApiClient = async (): Promise<AiApiClient> => {
  return ServiceProvider.getService(ServiceType.AiApiClient);
};

const callLLM = async (systemPrompt: string, userPrompt: string, context: string[]): Promise<string> => {

  const llm = process.env.LLM;
  console.log('llm = ' + llm);

  if (llm === "XGen") {
    const systemTag = '<|system|>';
    const endOfPromptTag = '<|endofprompt|>';
    const userTag = '<|user|>';
    const assistantTag = '<|assistant|>';

    let input =
    `${systemTag}\n${systemPrompt}\n\n${endOfPromptTag}\n${userTag}\n` +
    userPrompt +
    `\n\nThis is the Apex class the OpenAPI v3 specification should be generated for:\n\`\`\`\n` +
    context[0];

    for (let i = 1; i < context.length; i++) {
      input += `\n\nContext ${i}:\n\`\`\`\n${context[i]}`;
    }

    input +=
    `\n\`\`\`\n${endOfPromptTag}\n${assistantTag}`;
    console.log('input = ' + input);

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

    return documentContents;
  }

  else if (llm === "OpenAI") {
    return 'OpenAI case';
  }

  return 'This shouldn\'t be reached';
}
