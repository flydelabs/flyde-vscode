// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import { FlydeEditorEditorProvider } from './flydeEditor';
import * as execa from 'execa';

var fp = require("find-free-port");

import { initFlydeDevServer } from '@flyde/dev-server/dist/lib';

import { join } from 'path';
import { workerData } from 'worker_threads';


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

		const fileName = await vscode.window.showInputBox({
			title: 'File name',
			value: 'my-flow.flyde',
			validateInput: (str) => str.endsWith('.flyde') ? undefined : 'File name must have the ".flyde" extension'
		});

		if (!fileName) {
			vscode.window.showWarningMessage('No file name passed, aborting');
			return;
		}



		const templateBytes = await fs.readFile(Uri.joinPath(context.extensionUri, 'src/flows/default-visual.flyde'));
		const templateString = Buffer.from(templateBytes).toString('utf8');

		const targetPath = Uri.joinPath(dirName, fileName);

		if (await (fs.readFile(targetPath).then(() => true, () => false)) === true) {
			vscode.window.showErrorMessage(`File ${targetPath} aleady exists!`);
			return;
		}

		await vscode.workspace.fs.writeFile(targetPath, templateBytes);
		// const result = await vscode.window.showQuickPick(['Visual Flow', 'Code Flow']);
		vscode.window.showInformationMessage(`New flow created at ${targetPath}!`);

		vscode.commands.executeCommand("vscode.openWith", targetPath, 'flydeEditor');


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


