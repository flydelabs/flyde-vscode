// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

import { FlydeEditorEditorProvider } from "./flydeEditor";
import * as execa from "execa";

var fp = require("find-free-port");

import { initFlydeDevServer } from "@flyde/dev-server/dist/lib";

import { join } from "path";
import { FlydeFlow, visualPart, randomInt, middlePos, values } from "@flyde/core";
import { partInput } from "@flyde/core";
import { partOutput } from "@flyde/core";
import { serializeFlow } from "@flyde/resolver";
import { connectionData } from "@flyde/core";
import { inlinePartInstance } from "@flyde/core";
import { createDefaultPart } from "./create-default-part";

import TelemetryReporter from '@vscode/extension-telemetry';
import { activateReporter, reportEvent } from "./telemetry";

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

  fp(FLYDE_DEFAULT_SERVER_PORT).then(([port]: [number]) => {

    reportEvent('devServerStart');
    console.log(`Starting Flyde server on port ${port}`);

    const editorStaticsRoot = join(__dirname, "../editor-build");
    server = initFlydeDevServer({ port, root: fileRoot, editorStaticsRoot });
    // const editorStaticRoot = vscode.Uri.joinPath(context.extensionUri, 'editor-build').toString();
    // process = execa.execaCommand(`node ${file} --port ${port} --root ${fileRoot}`, {stdio: 'inherit'});

    context.subscriptions.push(
      FlydeEditorEditorProvider.register(context, port)
    );
    // runDevServer(port, fileRoot);
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

        const partId = await vscode.window.showInputBox({
          title: "Name your flow",
          value: "MyAwesomeFlow" + randomInt(999),
        });

        if (!partId) {
          vscode.window.showWarningMessage("No part id passed, aborting");
          return;
        }

        const fileName = await vscode.window.showInputBox({
          title: "Flow file name",
          value: `${partId}.flyde`,
          validateInput: (str) =>
            str.endsWith(".flyde")
              ? undefined
              : 'File name must have the ".flyde" extension',
        });

        if (!fileName) {
          vscode.window.showWarningMessage("No file name passed, aborting");
          return;
        }

        const targetPath = Uri.joinPath(folderUri, fileName);

        if (
          (await fs.readFile(targetPath).then(
            () => true,
            () => false
          )) === true
        ) {
          vscode.window.showErrorMessage(`File ${targetPath} aleady exists!`);
          return;
        }

        const inputNamesRaw = await vscode.window.showInputBox({
          title: `Enter your new part's inputs?`,
          prompt: 'Leave black for none. Enter multiple values by using commas',
          placeHolder: 'i.e. "name, age, profession',
          value: ""
        });

        const outputNamesRaw = await vscode.window.showInputBox({
          title: `Enter your new part's outputs`,
          prompt: 'Leave black for none. Enter multiple values using commas',
          placeHolder: 'i.e. "result1, result2"',
          value: ""
        });

        const toArr = (raw: string | undefined) => {
          if (raw) {
            return Array.from(new Set(raw.split(',').map(s => s.trim())));
          } else {
            return [];
          }
        };

        const inputNames = toArr(inputNamesRaw);
        const outputNames = toArr(outputNamesRaw);

        const part = visualPart({
          id: partId,
          inputs: inputNames.reduce(
            (acc, name) => ({ ...acc, [name]: partInput() }),
            {}
          ),
          inputsPosition: inputNames.reduce(
            (acc, name, idx) => ({
              ...acc,
              [name]: { x: idx * 200, y: 0 },
            }),
            {}
          ),
          outputs: outputNames.reduce(
            (acc, name) => ({ ...acc, [name]: partOutput() }),
            {}
          ),
          outputsPosition: outputNames.reduce(
            (acc, name, idx) => ({
              ...acc,
              [name]: { x: idx * 200, y: 500 },
            }),
            {}
          ),
          completionOutputs: outputNames.length ? [outputNames.join("+")] : [], // TODO - let configure this
          instances: [],
          connections: [
            ...inputNames.map((name) => connectionData([name], ["ins1", name])),
            ...outputNames.map((name) =>
              connectionData(["ins1", 'value'], [name])
            ),
          ],
        });

        const defaultPart = createDefaultPart(inputNames);

        const middleOfInputs = inputNames.length ? values(part.inputsPosition)
          .reduce(middlePos) : {x: 0, y: 0};

        const middleOfOutputs = outputNames.length ? values(part.outputsPosition)
          .reduce(middlePos) : {x: 0, y: 500};

        const middleOfInputsAndOutputs = middlePos(middleOfInputs, middleOfOutputs);
        // part width 
        
        const PART_WIDTH_TODO_GET_FROM_EDITOR = 400;
        const instancePosition = {...middleOfInputsAndOutputs, x: middleOfInputsAndOutputs.x - PART_WIDTH_TODO_GET_FROM_EDITOR/2};

        // create a fake instance in the middle
        part.instances.push(
          inlinePartInstance(
            "ins1",
            defaultPart,
            undefined,
            instancePosition
          )
        );

        const flow: FlydeFlow = {
          imports: {},
          part,
        };

        try {
          const serializedFlow = serializeFlow(flow);

          const buff = Buffer.from(serializedFlow, "utf-8");

          await vscode.workspace.fs.writeFile(targetPath, buff);
          // const result = await vscode.window.showQuickPick(['Visual Flow', 'Code Flow']);
          vscode.window.showInformationMessage(
            `New flow created at ${fileName}!`
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
