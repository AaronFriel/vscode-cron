import path from 'path';
import fse from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import vscode from 'vscode';

let $context: vscode.ExtensionContext;
let $uuid: string;
let $mutex: string;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  $context = context;
  $uuid = uuidv4();

  const storagePath = path.join($context.globalStorageUri.fsPath, 'mutexes', vscode.env.remoteName ?? 'local');
  await fse.mkdirp(storagePath);

  $mutex = path.join(storagePath, 'mutex');

  vscode.window.onDidChangeWindowState((state) => {
    if (state.focused) {
      void fse.writeFile($mutex, $uuid);
    }
  });

  return fse.writeFile($mutex, $uuid);
}

export async function deactivate(): Promise<void> {
  return fse.writeFile($mutex, '');
}

export async function isMain(): Promise<boolean> {
  const mainWindow = await fse.readFile($mutex, 'utf8');

  if (mainWindow) {
    return mainWindow === $uuid;
  } else {
    void fse.writeFile($mutex, $uuid);

    return new Promise((resolve) => {
      setTimeout(async () => {
        const mainWindow = await fse.readFile($mutex, 'utf8');

        resolve(mainWindow === $uuid);
      }, 1000);
    });
  }
}
