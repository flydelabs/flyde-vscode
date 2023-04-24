// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

import { FlydeEditorEditorProvider } from "./flydeEditor";
import * as execa from "execa";

var fp = require("find-free-port");

import { initFlydeDevServer } from "@flyde/dev-server/dist/lib";

import { join } from "path";
import { randomInt } from "@flyde/core";

import TelemetryReporter from "@vscode/extension-telemetry";
import { activateReporter, reportEvent } from "./telemetry";
import path = require("path");

import { Template, getTemplates, scaffoldTemplate } from "./templateUtils";

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

  reportEvent("activate");

  const mainOutputChannel = vscode.window.createOutputChannel("Flyde");
  const debugOutputChannel = vscode.window.createOutputChannel("Flyde (Debug)");

  fp(FLYDE_DEFAULT_SERVER_PORT).then(([port]: [number]) => {
    reportEvent("devServerStart");

    const editorStaticsRoot = join(__dirname, "../editor-build");
    const cleanServer = initFlydeDevServer({
      port,
      root: fileRoot,
      editorStaticsRoot,
    });

    context.subscriptions.push({
      dispose() {
        cleanServer();
      },
    });

    context.subscriptions.push(
      FlydeEditorEditorProvider.register(context, {
        port,
        mainOutputChannel,
        debugOutputChannel,
      })
    );
  });

  const openAsTextHandler = (uri: vscode.Uri) => {
    reporter.sendTelemetryEvent("openAsText");
    vscode.commands.executeCommand("workbench.action.reopenWithEditor", uri);
  };

  context.subscriptions.push(
    vscode.commands.registerCommand("flyde.openAsText", openAsTextHandler)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "flyde.newVisualFlow",
      async (dirName: vscode.Uri) => {
        reportEvent("newVisualFlow:start");
        // use this if triggered by a menu item,
        let folderOrFileUri = dirName; // folder will be undefined when triggered by keybinding

        if (!folderOrFileUri) {
          // so triggered by a keybinding
          const originalClipboard = await vscode.env.clipboard.readText();

          await vscode.commands.executeCommand("copyFilePath");
          const pathResult = await vscode.env.clipboard.readText(); // returns a string

          await vscode.env.clipboard.writeText(originalClipboard);

          folderOrFileUri = await vscode.Uri.file(pathResult); // make it a Uri

          const stat = await fs.stat(folderOrFileUri);
          if (stat.type === vscode.FileType.File) {
            folderOrFileUri = vscode.Uri.joinPath(folderOrFileUri, "..");
          }
        }

        const folderStat = await fs.stat(folderOrFileUri);
        const folderUri =
          folderStat.type === vscode.FileType.Directory
            ? folderOrFileUri
            : vscode.Uri.joinPath(folderOrFileUri, "..");

        const templates = getTemplates();

        const template = await vscode.window.showQuickPick<
          Template & { label: string }
        >(
          templates.map((t) => ({
            ...t,
            label: t.name,
            description: t.tags.join(", "),
            detail: t.description,
          }))
        );

        if (!template) {
          vscode.window.showWarningMessage("No template selected, aborting");
          return;
        }

        const fileName = await vscode.window.showInputBox({
          title: "Flow file name",
          value: `${"MyAwesomeFlow" + randomInt(999)}`,
        });

        if (!fileName) {
          vscode.window.showWarningMessage("No file name passed, aborting");
          return;
        }

        const targetPath = Uri.joinPath(folderUri, fileName + ".flyde");

        if (
          (await fs.readFile(targetPath).then(
            () => true,
            () => false
          )) === true
        ) {
          vscode.window.showErrorMessage(`File ${targetPath} already exists!`);
          return;
        }
        try {
          reportEvent("newVisualFlow:before", { template: template.name });
          scaffoldTemplate(template, folderUri.fsPath, fileName);
          vscode.commands.executeCommand(
            "vscode.openWith",
            targetPath,
            "flydeEditor"
          );
          reportEvent("newVisualFlow:success", { template: template.name });
          vscode.window.showInformationMessage(
            `New flow created at ${fileName}.flyde!`
          );
        } catch (error) {
          vscode.window.showErrorMessage(`Error creating flow: ${error}`);
        }
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
