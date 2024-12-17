/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { sendApexPromptToLLM } from './sendApexPromptToLLM';
import { sendYamlPromptToLLM } from './sendYamlPromptToLLM';

const registerCommands = (): vscode.Disposable => {
  const sendApexPromptToLLMCmd =  vscode.commands.registerCommand('sf.send.apex.prompt.to.llm', sendApexPromptToLLM);
  const sendYamlPromptToLLMCmd =  vscode.commands.registerCommand('sf.send.yaml.prompt.to.llm', sendYamlPromptToLLM);
  return vscode.Disposable.from(sendApexPromptToLLMCmd, sendYamlPromptToLLMCmd);
};

export const activate = async (extensionContext: vscode.ExtensionContext) => {
  console.log('Prompt Engineering Playground extension - enter activate()');
  const commands = registerCommands();
  extensionContext.subscriptions.push(commands);
  console.log('Prompt Engineering Playground extension - exit activate()');
};

export const deactivate = async (): Promise<void> => {};
