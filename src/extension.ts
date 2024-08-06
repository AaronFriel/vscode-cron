import vscode from 'vscode';
import { Scheduler, TaskType } from './scheduler';
import * as window from './window';

const CONFIG_KEY = 'cron';

type Task = {
  id?: string;
	type?: TaskType;
  schedule: string;
  command: string;
  args?: string[];
  conditions?: TaskConditions;
};

type TaskConditions = {
  exclusive?: boolean;
  remoteName?: string;
  shell?: string;
};

function setup(): void {
  const config = vscode.workspace.getConfiguration(CONFIG_KEY, null);
  const scheduler = Scheduler.get().setup(config);

  scheduler.removeTasks();

  for (const { id, type, schedule, command, args, conditions } of config.get<Task[]>('tasks') ?? []) {
		scheduler.addTask({
      id,
      type: type ?? 'shell',
      schedule,
      command,
      args,
			conditions: {
				exclusive: conditions?.exclusive ?? true,
				remoteName: conditions?.remoteName ? new RegExp(conditions.remoteName) : undefined,
				shell: conditions?.shell ? new RegExp(conditions.shell) : undefined,
			}
    });
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  setup();

  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration(CONFIG_KEY)) {
      setup();
    }
  });

  await window.activate(context);
}

export async function deactivate(): Promise<void> {
  return window.deactivate();
}
