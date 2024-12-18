import * as vscode from 'vscode';
import { ServiceProvider, ServiceType, AiApiClient, CommandSource, processGeneration } from '@salesforce/vscode-service-provider';
import * as fs from 'fs';
import { DEFAULT_INSTRUCTIONS, ETHICS_INSTRUCTIONS } from './constants';

/**
 * Reads the Apex file for which the OpenAPI v3 specification should be generated.
 * Calls callLLM() to send the prompt to the XGen LLM.
 * Writes the response to a file.
 *
 * @throws Will throw an error if there is no active editor.
 */
export const sendApexPromptToLLM = async (): Promise<void> => {
  console.log('This is the sendApexPromptToLLM() method');
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw Error('No active editor detected');
  }

  const editorView = editor.document;
  const editorText = editorView.getText();
  console.log('document text = ' + editorText);

  const systemPrompt = `${DEFAULT_INSTRUCTIONS}\n\n${ETHICS_INSTRUCTIONS}`

  const userPrompt = await constructUserPrompt(editorText);

  const documentContents = await callLLM(systemPrompt, userPrompt, [editorText]);

  console.log('documentContents = ~' + documentContents + '~');

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const formattedDate = `${month}${day}${year}_${hours}:${minutes}:${seconds}`;

  const documentContentsFileName = `documentContents_${formattedDate}.yaml`;
  fs.writeFileSync(documentContentsFileName, documentContents);
}

/**
 * Gets the AiApi client from the service provider.
 *
 * @returns {AiApiClient} The AiApi client.
 */
export const getAiApiClient = async (): Promise<AiApiClient> => {
  return ServiceProvider.getService(ServiceType.AiApiClient);
};

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
const callLLM = async (systemPrompt: string, userPrompt: string, context: string[]): Promise<string> => {

  const llm = process.env.LLM;
  console.log('llm = ' + llm);

  if (llm === "XGen") {
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

  if (editorText.includes('@AuraEnabled')) {
    userPrompt += 'Only include methods that have the @AuraEnabled annotation in the paths of the OpenAPI v3 specification.\n';
  }

  if (editorText.includes('@HttpGet') || editorText.includes('@HttpDelete')) {
    userPrompt += 'Methods annotated with @HttpGet or @HttpDelete must have no parameters. This is because GET and DELETE requests have no request body, so there\'s nothing to deserialize.\n';
  }

  if (editorText.includes('SELECT Id')) {
    userPrompt += 'When you return Id in a SOQL query, it has `type: Id`.\n';
  }

  return userPrompt;
}
