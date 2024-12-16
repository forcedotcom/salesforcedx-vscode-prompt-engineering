import { ServiceProvider, ServiceType, AiApiClient, CommandSource, processGeneration } from '@salesforce/vscode-service-provider';
import * as fs from 'fs';
import * as YAML from 'yaml';

const sendPromptToLLM = async (promptFileName: string): Promise<void> => {
  console.log('This is the sendPromptToLLM() method');

  const promptText = fs.readFileSync(promptFileName, 'utf8');
  console.log('document text = ' + promptText);
  const promptYaml = YAML.parse(promptText);

  const experimentId = promptYaml.experiment;
  const systemPrompt = promptYaml.systemPrompt;
  const userPrompt = promptYaml.userPrompt;
  const context = promptYaml.context;

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

const callLLM = async (systemPrompt: string, userPrompt: string, context: string[]): Promise<string> => {
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

// -------------------------------------------------------------------
// Call the function with the prompt file name
const promptFileName = process.argv[2];
console.log('promptFileName = ' + promptFileName);
if (!promptFileName) {
  console.error('Prompt file name not provided.');
  process.exit(1);
}
sendPromptToLLM(promptFileName).catch(console.error);
