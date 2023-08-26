// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import * as path from "path";
import { webviewTestingCommand } from "./testUtils";
import assert = require("assert");
import { delay, eventually } from "@flyde/core";

suite("Extension Test Suite", () => {
  test("Loads test flow and renders instance views", async () => {
    const testFile = vscode.Uri.file(
      path.resolve(__dirname, "../../test-fixtures/HelloWorld.flyde")
    );

    await vscode.commands.executeCommand(
      "vscode.openWith",
      testFile,
      "flydeEditor"
    );

    await eventually(async () => {
      const instances = await webviewTestingCommand("$$", {
        selector: ".ins-view-inner",
      });
      console.log({ instances });

      assert(
        instances.length === 4,
        "Expected fixture flow to have 4 instances"
      );
    }, 5000);
  }).timeout(10000);

  test("Renders add node modal", async () => {
    const testFile = vscode.Uri.file(
      path.resolve(__dirname, "../../test-fixtures/HelloWorld.flyde")
    );

    await vscode.commands.executeCommand(
      "vscode.openWith",
      testFile,
      "flydeEditor"
    );

    await eventually(async () => {
      const elements = await webviewTestingCommand("$$", {
        selector: ".actions-menu > .action-button:nth-child(1)",
      });

      assert(
        elements.length === 1,
        "Expected to find the add node button in the actions menu"
      );
    });

    await webviewTestingCommand("click", {
      selector: ".actions-menu > .action-button:nth-child(1)",
    });

    await eventually(async () => {
      const elements = await webviewTestingCommand("$$", {
        selector: ".add-node-menu-list-item",
      });
      assert(elements.length > 100, "Expected to find 100+ items in the menu");
    });
  }).timeout(10000);
});
