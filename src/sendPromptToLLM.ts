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

  const systemTag = '<|system|>';
  const endOfPromptTag = '<|endofprompt|>';
  const userTag = '<|user|>';
  const assistantTag = '<|assistant|>';

  const input =
    `${systemTag}\n${systemPrompt}\n\n${endOfPromptTag}\n${userTag}\n` +
    userPrompt +
    `\n\n***Code Context***\n\`\`\`\n` +
    editorText +
    `\n\`\`\`\n${endOfPromptTag}\n${assistantTag}`;
  console.log('input = ' + input);

  const apiClient = await getAiApiClient();
  // const result = await apiClient.naturalLanguageQuery({
  //   prefix: '',
  //   suffix: '',
  //   input: input,
  //   commandSource: CommandSource.NLtoCodeGen,
  //   promptId: 'generateOpenAPIv3Specifications'
  // });

  // const documentContents = result[0].completion;

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

  console.log('documentContents = ~' + documentContents + '~');
  fs.writeFileSync("documentContents.yaml", documentContents);
}

export const getAiApiClient = async (): Promise<AiApiClient> => {
  return ServiceProvider.getService(ServiceType.AiApiClient);
};
