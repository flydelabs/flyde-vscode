// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import * as path from "path";
import { inspectLastWebviewElements } from "./testUtils";
import assert = require("assert");

suite("Extension Test Suite", () => {
  test("Loads test flow and renders instance views", async () => {
    const testFile = vscode.Uri.file(
      path.resolve(__dirname, "../../test-fixtures/HelloWorld.flyde")
    );
    console.log({ testFile });

    await vscode.commands.executeCommand(
      "vscode.openWith",
      testFile,
      "flydeEditor"
    );

    const instances = await inspectLastWebviewElements(".ins-view-inner");

    assert(instances.length === 4, "Expected fixture flow to have 4 instances");
  }).timeout(5000);
});
