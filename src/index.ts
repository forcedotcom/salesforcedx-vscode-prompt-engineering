/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';
import { sendApexPromptToLLM } from './sendApexPromptToLLM';
import { sendYamlPromptToLLM } from './sendYamlPromptToLLM';
import { generateSampleYamlPrompt } from './generateSampleYamlPrompt';
import * as fs from 'fs';
import * as path from "path";

const registerCommands = (): vscode.Disposable => {
  const sendApexPromptToLLMCmd =  vscode.commands.registerCommand('sf.send.apex.prompt.to.llm', sendApexPromptToLLM);
  const sendYamlPromptToLLMCmd =  vscode.commands.registerCommand('sf.send.yaml.prompt.to.llm', sendYamlPromptToLLM);

  const generateSampleYamlPromptCmd = vscode.commands.registerCommand('sf.generate.sample.yaml.prompt', async () => {
    const filename = await vscode.window.showInputBox({
      prompt: 'Enter the filename for the YAML file',
      placeHolder: 'sampleprompt',
      value: 'sampleprompt'
    });
    if (!filename) {
      vscode.window.showErrorMessage('Filename is required.');
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    const defaultFolder = workspaceFolders ? path.join(workspaceFolders[0].uri.fsPath, 'experiments') : '';
    const uri = await vscode.window.showOpenDialog({
      defaultUri: vscode.Uri.file(defaultFolder),
      canSelectFolders: true,
      canSelectFiles: false,
      openLabel: 'Select Folder'
    });
    if (!uri || uri.length === 0) {
      vscode.window.showErrorMessage('Filepath is required.');
      return;
    }

    const filepath = uri[0].fsPath;
    const fullFilePath = `${filepath}/${filename}.yaml`;

    if (fs.existsSync(fullFilePath)) {
      vscode.window.showErrorMessage(`File '${filename}.yaml' already exists at '${filepath}'.`);
      return;
    }
    await generateSampleYamlPrompt(`${filepath}/${filename}.yaml`);
    vscode.window.showInformationMessage(`YAML file '${filename}.yaml' created successfully at '${filepath}'.`);
  });

  return vscode.Disposable.from(sendApexPromptToLLMCmd, sendYamlPromptToLLMCmd, generateSampleYamlPromptCmd);
};

export const activate = async (extensionContext: vscode.ExtensionContext) => {
  console.log('Prompt Engineering Playground extension - enter activate()');
  const commands = registerCommands();
  extensionContext.subscriptions.push(commands);
  console.log('Prompt Engineering Playground extension - exit activate()');
};

export const deactivate = async (): Promise<void> => {};
