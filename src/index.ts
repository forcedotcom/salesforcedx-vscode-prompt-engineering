/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { sendPromptToLLM } from './sendPromptToLLM';

const registerCommands = (): vscode.Disposable => {
  return vscode.commands.registerCommand('sf.send.prompt.to.llm', sendPromptToLLM);
};

export const activate = async (extensionContext: vscode.ExtensionContext) => {
  console.log('Prompt Engineering Playground extension - enter activate()');
  const commands = registerCommands();
  extensionContext.subscriptions.push(commands);
  console.log('Prompt Engineering Playground extension - exit activate()');
};

export const deactivate = async (): Promise<void> => {};
