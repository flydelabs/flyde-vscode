import * as vscode from "vscode";

let askedThisSession = false;
// checks if the user hasn't seen this message before, and if so, asks them to star the project
export function maybeAskToStarProject(delay: number) {
  if (
    askedThisSession ||
    vscode.workspace
      .getConfiguration()
      .get("flyde.askedToStarProject", vscode.ConfigurationTarget.Global)
  ) {
    return;
  }

  askedThisSession = true;

  setTimeout(() => {
    vscode.window
      .showInformationMessage(
        "If you like Flyde, please star the project on GitHub!",
        "Sure, I'll star it! 🌟",
        "No, maybe later",
        "Don't ask again"
      )
      .then((answer) => {
        if (answer === "Sure, I'll star it! 🌟") {
          vscode.env.openExternal(
            vscode.Uri.parse("https://www.github.com/FlydeHQ/flyde")
          );

          vscode.window.showInformationMessage("Thanks for your support! 🙏");
        }

        if (answer !== "No, maybe later") {
          vscode.workspace
            .getConfiguration()
            .update(
              "flyde.askedToStarProject",
              true,
              vscode.ConfigurationTarget.Global
            );
        }
      });
  }, delay);
}
