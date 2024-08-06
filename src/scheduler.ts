import { Cron } from 'croner';
import { v4 as uuidv4 } from 'uuid';
import vscode from 'vscode';
import * as window from './window';
import z from 'zod';

export type Task = {
  type: TaskType;
  command: string;
  args: string[] | undefined;
  cron: Cron;
  schedule: string;
  id: string;
  conditions: Conditions;
  runId: number;
};

export type Conditions = {
  exclusive: boolean;
  remoteName?: RegExp;
  shell?: RegExp;
};

export const TaskType = z.enum(['shell', 'vscode-command']);

export type TaskType = z.infer<typeof TaskType>;

export class Scheduler {
  private readonly _tasks: Record<string, Task> = {};
  private _channel!: vscode.OutputChannel;
  private _debug: boolean = false;
  private _useBlank: boolean = false;

  public static get(): Scheduler {
    return $instance;
  }

  public addTask({
    id = uuidv4(),
    type,
    schedule,
    command,
    args,
    conditions,
  }: {
    id: string | undefined;
    type: TaskType;
    schedule: string;
    command: string;
    args: string[] | undefined;
    conditions: Conditions;
  }): string {
    const cron = new Cron(schedule);
    const task: Task = {
      type,
      schedule,
      command,
      args,
      cron,
      id,
      conditions,
      runId: 1,
    };

    cron.schedule(async () => this.run(task));

    this._tasks[id] = task;

    if (this._debug) {
      this._channel.show(true);
    }

    const next = cron.nextRun();
    this._channel.appendLine(
      `[new-task](${task.id}) pattern: ${schedule}, command: ${command}, next: ${next ? next.toISOString() : '-no-'}`,
    );

    return id;
  }

  public removeTask(uuid: string): boolean {
    if (this._tasks[uuid]) {
      this._channel.appendLine(`[del-task](${uuid})`);

      this._tasks[uuid].cron.stop();

      delete this._tasks[uuid];

      return true;
    } else {
      return false;
    }
  }

  public removeTasks(): void {
    for (const [uuid, task] of Object.entries(this._tasks)) {
      task.cron.stop();

      this._channel.appendLine(`[del-task](${uuid})`);

      delete this._tasks[uuid];
    }
  }

  private async run(task: Task): Promise<void> {
    if (this._debug) {
      this._channel.show(true);
    }

    const runId = task.runId;
    task.runId += 1;
    const taskName = `${task.id}-${runId}`;
    const next = task.cron.nextRun();

    const remoteName = vscode.env.remoteName ?? 'local';
    const shell = vscode.env.shell ?? '';
    let filteredBy: string[] = [];
    if (task.conditions.remoteName && !task.conditions.remoteName.test(remoteName)) {
      filteredBy.push(`remoteName (${remoteName}) does not match condition ${task.conditions.remoteName})`);
    }
    if (task.conditions.shell && !task.conditions.shell.test(shell)) {
      filteredBy.push(`shell (${shell}) does not match condition ${task.conditions.shell})`);
    }
    if (task.conditions.exclusive && !(await window.isMain())) {
      filteredBy.push(`exclusive (window is not main)`);
    }

    if (filteredBy.length > 0) {
      this._channel.appendLine(`[run-task](${taskName}) filtered by conditions: ${filteredBy.join(', ')}`);
      return;
    }

    this._channel.appendLine(
      `[run-task](${taskName}) main: true, next: ${
        next ? next.toISOString() : '-no-'
      }, remoteName: ${remoteName}, shell: ${task.conditions?.shell ?? 'default'}`,
    );

    if (this._useBlank) {
      this._channel.appendLine(`[exe-task](${taskName}) blank`);
    } else {
      this._channel.appendLine(`[exe-task](${taskName}) command: ${task.command}`);
      try {
        if (task.type === 'shell') {
          const codeTask = new vscode.Task(
            {
              type: 'cron',
              name: taskName,
            },
            vscode.TaskScope.Workspace,
            taskName,
            `cron.tasks:${taskName}`,
            task.args
              ? new vscode.ShellExecution(task.command + ' ' + task.args.join(' '))
              : new vscode.ShellExecution(task.command),
          );

          codeTask.isBackground = true;
          codeTask.presentationOptions = {
            reveal: vscode.TaskRevealKind.Never,
            clear: false,
            echo: false,
            focus: false,
            showReuseMessage: false,
            close: false,
            panel: vscode.TaskPanelKind.Shared,
          };
          codeTask.runOptions = {
            // @ts-ignore
            instanceLimit: 100,
          };
          new Promise<void>((resolve, reject) => {
            const disposable = vscode.tasks.onDidEndTaskProcess((e) => {
              if (e.execution.task.name === taskName) {
                disposable.dispose();
                if (e.exitCode !== 0) {
                  this._channel.appendLine(`[exe-task](${taskName}) failed: exitCode: ${e.exitCode}`);
                  reject(new Error(`exitCode: ${e.exitCode}`));
                } else {
                  this._channel.appendLine(`[exe-task](${taskName}) done`);
                  resolve();
                }
              }
            });
          });

          const execution = await vscode.tasks.executeTask(codeTask);
          this._channel.appendLine(`[exe-task](${taskName}) started: ${execution.task.runOptions}`);
        } else {
          await vscode.commands.executeCommand(task.command, ...(task.args ?? []));
        }
      } catch (error: unknown) {
        this._channel.appendLine(`[error] ${String(error)}`);
      }
    }
  }

  public setup(config: vscode.WorkspaceConfiguration): this {
    if (!this._channel) {
      this._channel = vscode.window.createOutputChannel('Cron');
    }

    const debug = config.get<boolean | string>('debug');

    if (typeof debug === 'boolean') {
      this._debug = debug;
      this._useBlank = false;
    } else if (debug === 'on') {
      this._debug = true;
      this._useBlank = false;
    } else if (debug === 'off') {
      this._debug = false;
      this._useBlank = false;
    } else if (debug === 'useBlank') {
      this._debug = true;
      this._useBlank = true;
    }

    return this;
  }
}

const $instance: Scheduler = new Scheduler();
