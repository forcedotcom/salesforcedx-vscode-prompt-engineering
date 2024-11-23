import * as vscode from 'vscode';
import { ServiceProvider, ServiceType, AiApiClient, CommandSource } from '@salesforce/vscode-service-provider';
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

  const input = '<|system|>\nabc\n\n<|endofprompt|>\n<|user|>\nCreate an OpenAPI v3 specification for this file\n\n***Code Context***\n```\n' + editorText + '```<|endofprompt|>\n<|assistant|>';
  console.log('input = ' + input);

  const apiClient = await getAiApiClient();
  const result = await apiClient.naturalLanguageQuery({
    prefix: '',
    suffix: '',
    input: input,
    commandSource: CommandSource.NLtoCodeGen,
    promptId: 'generateOpenAPIv3Specifications'
  });

  const documentContents = result[0].completion;
  fs.writeFileSync("documentContents.yaml", documentContents);
}

export const getAiApiClient = async (): Promise<AiApiClient> => {
  return ServiceProvider.getService(ServiceType.AiApiClient);
};
