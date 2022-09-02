// copies editor static files into dev server

const { join } = require("path");

const fsExtra = require('fs-extra');
const resolveFrom = require('resolve-from');

const editor = require.resolve('@flyde/editor');

const buildFolder = join(editor, '..');
console.log('Copying @flyde/editor build folder to dev server dist', {buildFolder});

const targetDir = join(__dirname, 'editor-build');

fsExtra.copySync(buildFolder, targetDir, { overwrite: true });

console.log('Done');
