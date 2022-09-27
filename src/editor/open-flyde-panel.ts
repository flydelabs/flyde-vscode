import { FlydeFlow, ResolvedFlydeFlowDefinition } from '@flyde/core';
import * as vscode from 'vscode';


export type WebviewContentParams = {
  extensionUri: vscode.Uri,
  relativeFile: string,
  port: number,
  webview: vscode.Webview,
  initialFlow: FlydeFlow,
  dependencies: ResolvedFlydeFlowDefinition,
  webviewId: string;
}

const isDev = process.env.MODE === 'dev';

const { Uri } = vscode;
const {fs} = vscode.workspace; 

const getScriptTagsFromReactAppHtml = async (root: vscode.Uri, webview: vscode.Webview, isDev: boolean) => {

  if (isDev) {
    return '<script defer="defer" src="http://localhost:3000/editor/static/js/bundle.js"></script>';
  } else {
    // this assumes react scripts will always remain on the same structure
    const html = await (await fs.readFile(vscode.Uri.joinPath(root, 'editor-build/index.html'))).toString();
  
    const scriptMatches = html.match(/\/editor\/static\/js\/(.*)\.js$/) || [];
    const styleMatches = html.match(/\/editor\/static\/css\/(.*)\.css$/) || [];

    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(root, scriptMatches[1]));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(root, styleMatches[1]));
  
    return `
    <script defer="defer" src="/editor/static/js/${scriptUri}.js"></script>
    <link href="/editor/static/css/${styleUri}.css" rel="stylesheet">
    `;
  }

};

export async function getWebviewContent(params: WebviewContentParams) {

    const {extensionUri, relativeFile, port, webview, initialFlow, dependencies} = params;
    const stylePath = vscode.Uri.joinPath(extensionUri, 'media', 'style.css');

    const wvStylePathwebview = webview.asWebviewUri(vscode.Uri.joinPath(stylePath));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'script.js'));

    const buildUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'editor-build'));

    // const INITIAL_DATA = JSON.stringify({webviewId, initialFlow, dependencies});

    // on dev mode we want to load the webpack hot reloaded version of the iframe, for quick feedback loop
    const appPort = isDev ? 3000 : port;
    
    
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-eval' 'unsafe-inline' ;script-src * 'unsafe-inline' 'unsafe-eval';img-src 'self' data:;">
      <title>Cat Coding Bob</title>
      <link href="${wvStylePathwebview}" rel="stylesheet">
      <link href="https://fonts.googleapis.com/css?family=Montserrat|Roboto|Roboto+Condensed|Roboto+Mono"
        rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css?family=Source+Code+Pro|Source+Sans+Pro" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700;800;900&display=swap"
        rel="stylesheet">

    
      <style>
      body {
          background: white;
          padding: 0px;
      }
          iframe {
            width: 100vh;
            height: 100vh;
        }
      </style>
      ${await getScriptTagsFromReactAppHtml(extensionUri, webview, isDev)}
    </head>
    <body>
    <!--- <iframe id="bob" src="http://localhost:${appPort}/editor/files?fileName=${encodeURIComponent(relativeFile)}&port=${port}&embedded=1" style="width: 100vw; height: 100vh" sandbox="allow-scripts allow-modals"></iframe> -->
    <script src="${scriptUri}"></script>
    <script type="text/javascript">console.log(42)</script>

    <div id="root">
      <div style="display: flex; align-items: center;justify-content: center;height:100vh;width: 100vw">
        <img src="${buildUri}/loader.svg" />
      </div>
    </div>

    </body>
    </html>`;
}


