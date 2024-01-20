// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import * as path from "path";
import { webviewTestingCommand } from "./testUtils";
import assert = require("assert");
import { eventually } from "@flyde/core";
import { getTemplates } from "../templateUtils";

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

      assert(
        instances.length === 4,
        "Expected fixture flow to have 4 instances"
      );
    }, 4000);
  }).retries(3);

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
        selector: ".nodes-library .view-all button",
      });

      assert(
        elements.length === 1,
        "Expected to find the add node button in the actions menu"
      );
    });

    await webviewTestingCommand("click", {
      selector: ".nodes-library .view-all button",
    });

    await eventually(async () => {
      const elements = await webviewTestingCommand("$$", {
        selector: ".add-node-menu-list-item",
      });
      assert(elements.length > 100, "Expected to find 100+ items in the menu");
    });
  }).retries(3);

  suite("Templates", () => {
    const templateFiles = getTemplates();

    test("Loads all templates", async () => {
      assert(
        templateFiles.length > 0,
        "Expected to find at least one template"
      );
    }).retries(3);

    templateFiles.forEach((templateFile) => {
      test(`Loads ${templateFile.name} template`, async () => {
        const flowPath = path.join(templateFile.fullPath, "Example.flyde");
        const testFile = vscode.Uri.file(flowPath);

        await vscode.commands.executeCommand(
          "vscode.openWith",
          testFile,
          "flydeEditor"
        );

        await eventually(async () => {
          const flowEditor = await webviewTestingCommand("$$", {
            selector: ".flyde-flow-editor",
          });

          assert(flowEditor.length === 1, ".flyde-flow-editor not found");
        }, 4000);
      }).retries(3);
    });
  });
});
