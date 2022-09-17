// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { FlydeEditorEditorProvider } from './flydeEditor';
import * as execa from 'execa';

var fp = require("find-free-port");

import { initFlydeDevServer } from '@flyde/dev-server/dist/lib';

import { join } from 'path';
import { FlydeFlow, groupedPart } from '@flyde/core';
import { rnd } from '@flyde/flow-editor';
import { partInput } from '@flyde/core';
import { partOutput } from '@flyde/core';
import { serializeFlow } from '@flyde/runtime';
import { connectionData } from '@flyde/core';
import { inlinePartInstance } from '@flyde/core';


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

let server: any;

let process: execa.ExecaChildProcess;

const FLYDE_DEFAULT_SERVER_PORT = 8545;

export function activate(context: vscode.ExtensionContext) {

	// eslint-disable-next-line @typescript-eslint/naming-convention
	const {Uri} = vscode;
	const {fs} = vscode.workspace; 

	const firstWorkspace = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
	    const fileRoot = firstWorkspace ? firstWorkspace.uri.fsPath : '';


	fp(FLYDE_DEFAULT_SERVER_PORT).then(([port]: [number])  => {
		console.log(`Starting Flyde server on port ${port}`);

		// const devServerCli = require.resolve('@flyde/dev-server');

		// console.log({devServerCli});
		

		// const file = join(__dirname, '../node_modules/@flyde/dev-server/dist/cli.js');

		const editorStaticsRoot = join(__dirname, '../editor-build');
		server = initFlydeDevServer({port, root: fileRoot, editorStaticsRoot});
		// const editorStaticRoot = vscode.Uri.joinPath(context.extensionUri, 'editor-build').toString();
		// process = execa.execaCommand(`node ${file} --port ${port} --root ${fileRoot}`, {stdio: 'inherit'});
	
		context.subscriptions.push(FlydeEditorEditorProvider.register(context, port));
		// runDevServer(port, fileRoot);
	});

	const openAsTextHandler = (uri: vscode.Uri) => {
		vscode.commands.executeCommand('workbench.action.reopenWithEditor', uri);
	};
	
	context.subscriptions.push(vscode.commands.registerCommand('flyde.openAsText', openAsTextHandler));

	context.subscriptions.push(vscode.commands.registerCommand('flyde.newFlow', async (dirName: vscode.Uri) => {

		const partId = await vscode.window.showInputBox({
			title: 'Name your flow',
			value: 'MyAwesomeFlow' + rnd(999)
		});

		if (!partId) {
			vscode.window.showWarningMessage('No part id passed, aborting');
			return;
		}

		const fileName = await vscode.window.showInputBox({
			title: 'Flow file name',
			value:  `${partId}.flyde`,
			validateInput: (str) => str.endsWith('.flyde') ? undefined : 'File name must have the ".flyde" extension'
		});

		if (!fileName) {
			vscode.window.showWarningMessage('No file name passed, aborting');
			return;
		}

		const targetPath = Uri.joinPath(dirName, fileName);

		if (await (fs.readFile(targetPath).then(() => true, () => false)) === true) {
			vscode.window.showErrorMessage(`File ${targetPath} aleady exists!`);
			return;
		}

		const inputNames: string[] = [];
		const outputNames: string[] = [];
		while (true) {
			const input = await vscode.window.showInputBox({
				title: `Name your part\'s #${inputNames.length + 1} input (or leave empty to proceed)`,
				value: '',
				validateInput: (str) => inputNames.includes(str) ? `${str} input already exists` : undefined
			});

			if (input) {
				inputNames.push(input);
			} else {
				break;
			}
		}

		while (true) {
			const output = await vscode.window.showInputBox({
				title: `Name your part\'s #${outputNames.length + 1} output (or leave empty to proceed)`,
				value: '',
				validateInput: (str) => inputNames.concat(outputNames).includes(str) ? `${str} output/input already exists` : undefined
			});

			if (output) {
				outputNames.push(output);
			} else {
				break;
			}
		}


		const part = groupedPart({
			id: partId,
			inputs: inputNames.reduce((acc, name) => ({...acc, [name]: partInput('any')}), {}),
			inputsPosition: inputNames.reduce((acc, name, idx) => ({...acc, [name]: {x: idx * 200 + 50, y: 0} }), {}),
			outputs: outputNames.reduce((acc, name) => ({...acc, [name]: partOutput('any')}), {}),
			outputsPosition: outputNames.reduce((acc, name, idx) => ({...acc, [name]: {x: idx * 200 - 50, y: 500} }), {}),
			instances: [

			],
			connections: [
				...inputNames.map(name => connectionData([name], ['ins1', name])),
				...outputNames.map(name => connectionData(['ins1', name], [name]))
			]
		});

		// create a fake instance in the middle
		part.instances.push(inlinePartInstance('ins1', {...part, customViewCode: 'Your Logic Here 🕺🏼', connections: [], instances: []}, undefined, {
			y: 250, x: (inputNames.length * 200) / 2 + 25
		}));
		

		const flow: FlydeFlow = {
			imports: {},
			part
		};

		try {
			const serializedFlow = serializeFlow(flow);

			const buff = Buffer.from(serializedFlow, 'utf-8');
	
			await vscode.workspace.fs.writeFile(targetPath, buff);
			// const result = await vscode.window.showQuickPick(['Visual Flow', 'Code Flow']);
			vscode.window.showInformationMessage(`New flow created at ${targetPath}!`);
	
			vscode.commands.executeCommand("vscode.openWith", targetPath, 'flydeEditor');
		} catch (e: any) {
			vscode.window.showErrorMessage(`Error creating flow: ${e && e.message ? e.message : e}`);
		}
	

		// await vscode.workspace.openTextDocument(targetPath).then((arg) => {
		// 	console.log(arg);
			
		// }, (err) => {
		// 	console.log(err);
			
		// });


	}));
	
}

// this method is called when your extension is deactivated
export function deactivate() {
	if (server) {
		server.close();
	}
	if (process) {
		process.kill();
	}
}


