// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

import { FlydeEditorEditorProvider } from "./flydeEditor";
import * as execa from "execa";

var fp = require("find-free-port");

import { initFlydeDevServer } from "@flyde/dev-server/dist/lib";

import { join } from "path";
import { formatEvent, randomInt } from "@flyde/core";
import { deserializeFlowByPath, serializeFlow } from "@flyde/resolver";

import TelemetryReporter from '@vscode/extension-telemetry';
import { activateReporter, reportEvent } from "./telemetry";
import path = require("path");

import {createEditorClient}  from '@flyde/remote-debugger/dist/clients/editor';

// the application insights key (also known as instrumentation key)

// telemetry reporter
let reporter: TelemetryReporter;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

let server: any;

let process: execa.ExecaChildProcess;

const FLYDE_DEFAULT_SERVER_PORT = 8545;

export function activate(context: vscode.ExtensionContext) {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { Uri } = vscode;
  const { fs } = vscode.workspace;

  const firstWorkspace =
    vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
  const fileRoot = firstWorkspace ? firstWorkspace.uri.fsPath : "";

  // ensure it gets properly disposed. Upon disposal the events will be flushed
  context.subscriptions.push(activateReporter());

  reportEvent('activate');

  const outputChannel = vscode.window.createOutputChannel("Flyde");

  fp(FLYDE_DEFAULT_SERVER_PORT).then(([port]: [number]) => {

    reportEvent('devServerStart');
    console.log(`Starting Flyde server on port ${port}`);

    const editorStaticsRoot = join(__dirname, "../editor-build");
    server = initFlydeDevServer({ port, root: fileRoot, editorStaticsRoot });
    // const editorStaticRoot = vscode.Uri.joinPath(context.extensionUri, 'editor-build').toString();
    // process = execa.execaCommand(`node ${file} --port ${port} --root ${fileRoot}`, {stdio: 'inherit'});

    context.subscriptions.push(
      FlydeEditorEditorProvider.register(context, port, outputChannel)
    );
    // runDevServer(port, fileRoot);
    const _debugger = createEditorClient(`http://localhost:${port}`, 'n/a');

    _debugger.onBatchedEvents((events) => {
      events.forEach(event => {
        outputChannel.appendLine(formatEvent(event));
      });
    });
  });


  const openAsTextHandler = (uri: vscode.Uri) => {
    reporter.sendTelemetryEvent('openAsText');
    vscode.commands.executeCommand("workbench.action.reopenWithEditor", uri);
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("flyde.openAsText", openAsTextHandler)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "flyde.newVisualFlow",
      async (dirName: vscode.Uri) => {

        reportEvent('newVisualFlow:start');
        // use this if triggered by a menu item,
        let folderUri = dirName; // folder will be undefined when triggered by keybinding

        if (!folderUri) {
          // so triggered by a keybinding
          const originalClipboard = await vscode.env.clipboard.readText();

          await vscode.commands.executeCommand("copyFilePath");
          const pathResult = await vscode.env.clipboard.readText(); // returns a string

          await vscode.env.clipboard.writeText(originalClipboard);

          // see note below for parsing multiple files/folders
          folderUri = await vscode.Uri.file(pathResult); // make it a Uri
		  
		  const stat = await fs.stat(folderUri);
		  if (stat.type === vscode.FileType.File) {
			folderUri = vscode.Uri.joinPath(folderUri, '..');
		  }
        }

        const fileName = await vscode.window.showInputBox({
          title: "Flow file name",
          value: `${"MyAwesomeFlow" + randomInt(999)}`
        });

        if (!fileName) {
          vscode.window.showWarningMessage("No file name passed, aborting");
          return;
        }

        const targetPath = Uri.joinPath(folderUri, fileName + '.flyde');

        if (
          (await fs.readFile(targetPath).then(
            () => true,
            () => false
          )) === true
        ) {
          vscode.window.showErrorMessage(`File ${targetPath} already exists!`);
          return;
        }


        const flow = deserializeFlowByPath(path.join(__dirname, '../DefaultFlow.flyde'));

        flow.part.id = fileName;

        try {
          const serializedFlow = serializeFlow(flow);

          const buff = Buffer.from(serializedFlow, "utf-8");

          await vscode.workspace.fs.writeFile(targetPath, buff);
          // const result = await vscode.window.showQuickPick(['Visual Flow', 'Code Flow']);
          vscode.window.showInformationMessage(
            `New flow created at ${fileName}.flyde!`
          );


          vscode.commands.executeCommand(
            "vscode.openWith",
            targetPath,
            "flydeEditor"
          );
          reportEvent('newVisualFlow:success');

        } catch (e: any) {
          reportEvent('newVisualFlow:error', {error: e});

          vscode.window.showErrorMessage(
            `Error creating flow: ${e && e.message ? e.message : e}`
          );
        }

        // await vscode.workspace.openTextDocument(targetPath).then((arg) => {
        // 	console.log(arg);

        // }, (err) => {
        // 	console.log(err);

        // });
      }
    )
  );

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
