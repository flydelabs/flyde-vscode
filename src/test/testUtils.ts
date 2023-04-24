import { eventually } from "@flyde/core";
import * as vscode from "vscode";
import { getLastWebviewForTests } from "../flydeEditor";
import * as assert from "assert";

async function getLastWebview(): Promise<vscode.Webview> {
  await eventually(() => assert(!!getLastWebviewForTests()));
  return getLastWebviewForTests()!;
}

export async function inspectLastWebviewElements(
  selector: string
): Promise<{ innerHtml: string; textContent: string }[]> {
  const webview = await getLastWebview();
  return new Promise((res, rej) => {
    webview.onDidReceiveMessage((message) => {
      if (message.type === "__inspectElementsResponse") {
        if (message.payload.error) {
          rej(message.payload.error);
        } else {
          res(message.payload);
        }
      }
    });

    webview.postMessage({
      type: "__testInspectElements",
      payload: { selector },
    });
  });
}
