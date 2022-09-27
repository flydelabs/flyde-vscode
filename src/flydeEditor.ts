import path = require('path');
import * as vscode from 'vscode';
import { getWebviewContent } from './editor/open-flyde-panel';
var fp = require("find-free-port");

import { scanImportableParts} from '@flyde/dev-server/dist/service/scan-importable-parts';

import { EditorPorts, rnd } from  '@flyde/flow-editor';
import { deserializeFlow, resolveFlow, serializeFlow } from '@flyde/runtime';
import { ResolvedFlydeFlowDefinition } from '@flyde/core';

const FLYDE_DEFAULT_SERVER_PORT = 8545;

export type EditorPortType = keyof EditorPorts;

type Awaited<T> = T extends PromiseLike<infer U> ? U : T


type EmitterFn = (...params: any) => Promise<any>;
type ListenerFn = (cb: (...params: any) =>Promise<any> ) => void;

type PortFn = EmitterFn | ListenerFn;

type PortConfig<T extends PortFn> = {
    request: Parameters<T>,
    response: ReturnType<Awaited<T>>
};

type PostMsgConfig = {
    [Property in keyof EditorPorts]: PortConfig<EditorPorts[Property]>;
};

type FlydePortMessage<T extends EditorPortType> = {
	type: T,
	requestId: string,
	params: any; // PostMsgConfig[T]['params']
};

const tryOrThrow = (fn: Function, msg: string) => {
	try {
		return fn();
	} catch (e) {
		console.error(`Error editor error: ${msg}. Full error:`, e);

		return new Error(`Flyde editor error: ${msg}`);
	}
};


export class FlydeEditorEditorProvider implements vscode.CustomTextEditorProvider {

	port: number = FLYDE_DEFAULT_SERVER_PORT;

	setPort (port: number) {
		this.port = port;
	};

	public static register(context: vscode.ExtensionContext, port: number): vscode.Disposable {
		const provider = new FlydeEditorEditorProvider(context);

		provider.setPort(port);


        const firstWorkspace = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
	    const fileRoot = firstWorkspace ? firstWorkspace.uri.fsPath : '';

		const providerRegistration = vscode.window.registerCustomEditorProvider(FlydeEditorEditorProvider.viewType, provider);

		return providerRegistration;
	}

	private static readonly viewType = 'flydeEditor';

	constructor(
		private readonly context: vscode.ExtensionContext
	) { }

	/**
	 * Called when our custom editor is opened.
	 * 
	 * 
	 */

	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		// Setup initial content for the webview
		webviewPanel.webview.options = {
			enableScripts: true,
			portMapping: [{
				webviewPort: 3000,
				extensionHostPort: 3000
			}]
			
		};

        const firstWorkspace = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
	    const fileRoot = firstWorkspace ? firstWorkspace.uri.fsPath : '';

        const relative = path.relative(fileRoot, document.fileName);


		const messageResponse = (event: FlydePortMessage<any>, payload: any) => {
			webviewPanel.webview.postMessage({type: event.type, requestId: event.requestId, payload, source: 'extension'});
		};

		const raw = document.getText();
		const initialFlow = tryOrThrow(() => deserializeFlow(raw, document.uri.fsPath), 'Failed to deserialize flow');
		const dependencies = tryOrThrow(() => resolveFlow(document.uri.fsPath, 'definition') as ResolvedFlydeFlowDefinition, 'Failed to resolve flow\'s dependencies');

		const errors = [initialFlow, dependencies]
			.filter(obj => obj instanceof Error)
			.map((err: Error) => err.message);
		

		if (errors.length) {
			webviewPanel.webview.html = `Errors: ${errors.join('\n')}`;
			return initialFlow as any;
		}
		// used to avoid triggering "onChange" of the same webview
		const webviewId = `wv-${(Date.now() + rnd(999)).toString(32)}`;

		webviewPanel.webview.html = await getWebviewContent({
			extensionUri: this.context.extensionUri,
			relativeFile: relative,
			port: this.port,
			webview: webviewPanel.webview, 
			initialFlow,
			dependencies,
			webviewId
		});

		let lastSaveBy = '';
        
		webviewPanel.webview.onDidReceiveMessage(async (event: FlydePortMessage<any>) => {
			if (event.type && event.requestId) {
				switch (event.type) {
					case 'prompt': {
						const {defaultValue, text} = event.params;
						const value = await vscode.window.showInputBox({
							value: defaultValue,
							prompt: text
						});
						messageResponse(event, value);
						break;
					}
					case 'openFile': {
						const {absPath} = event.params;
						const uri = vscode.Uri.parse(absPath);

						const isFlydeFlow = absPath.endsWith('.flyde'); 
						if (isFlydeFlow) {
							const res = await vscode.commands.executeCommand("vscode.openWith", uri, 'flydeEditor');
							messageResponse(event, res);
						} else {
							const activeColumn = vscode.window.activeTextEditor?.viewColumn; // without passing the active column it seems to override the tab with the selection
							const res = await vscode.commands.executeCommand("vscode.open", uri, activeColumn);
							messageResponse(event, res);
						}
						break;
					}
					case 'readFlow': {
						const raw = document.getText();
						const flow = deserializeFlow(raw, document.uri.fsPath);
						messageResponse(event, flow);
						break;
					}

					case 'resolveDeps': {
						// const {absPath} = event.params;
						const flow = resolveFlow(document.uri.fsPath, 'definition');
						messageResponse(event, flow);
						break;
					}
					case 'saveFlow': {
						const {flow} = event.params;
						const serialized = serializeFlow(flow);
						const edit = new vscode.WorkspaceEdit();

						// replacing everything for simplicity. TODO - pass only delta changes
						const range = new vscode.Range(0, 0, document.lineCount, 0);
						edit.replace(document.uri, range, serialized);
						lastSaveBy = webviewId;
						await vscode.workspace.applyEdit(edit);
						messageResponse(event, undefined);
						break;
					}
					case 'getImportables': {
						const deps = await scanImportableParts(fileRoot, document.uri.fsPath);
						messageResponse(event, deps);
						break;
					}
					default: {
						vscode.window.showErrorMessage(`Handling of  ${event.type} is not implemented yet ??`);
						break;
					}
				}

			}
		});

		// Hook up event handlers so that we can synchronize the webview with the text document.
		//
		// The text document acts as our model, so we have to sync change in the document to our
		// editor and sync changes in the editor back to the document.
		// 
		// Remember that a single text document can also be shared between multiple custom
		// editors (this happens for example when you split a custom editor)

		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
			const isSameUri = e.document.uri.toString() === document.uri.toString();

			if (isSameUri && lastSaveBy !== webviewId) {
				const raw = document.getText();
				const flow = deserializeFlow(raw, document.uri.fsPath);
				const deps = resolveFlow(document.uri.fsPath, 'definition');
				webviewPanel.webview.postMessage({type: 'onFlowChange', requestId: 'TODO-cuid', params: {flow, deps}, source: 'extension'});
			}
		});

		// Make sure we get rid of the listener when our editor is closed.
		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
		});

	}

	/**
	 * Get the static html used for the editor webviews.
	 */
}