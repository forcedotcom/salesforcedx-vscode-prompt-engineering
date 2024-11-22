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

  const apiClient = await getAiApiClient();
  const result = await apiClient.naturalLanguageQuery({
    prefix: '',
    suffix: '',
    input: 'Create an OpenAPI v3 specification for this file',
    commandSource: CommandSource.NLtoCodeGen,
    promptId: 'generateOpenAPIv3Specifications'
  });

  const documentContents = result[0].completion;
  fs.writeFileSync("documentContents.yaml", documentContents);

  const document = editor.document;
  console.log('document text = ' + document.getText());
}

export const getAiApiClient = async (): Promise<AiApiClient> => {
  return ServiceProvider.getService(ServiceType.AiApiClient);
};
