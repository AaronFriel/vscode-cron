# cron

Run shell commands and VS Code commands on a schedule.

Forked from
[zokugun.cron-tasks](https://marketplace.visualstudio.com/items?itemName=zokugun.cron-tasks), and
with all due credit to [@zokugun](https://github.com/zokugun) for creating the original extension.

`cron` expands on the original extension by adding support for shell commands.

## Features

Configure `cron.tasks` in your `settings.json` to run shell commands and VS Code commands on a schedule.

```json
{
  "cron.tasks": [
    {
      "type": "shell",
      "schedule": "*/5 * * * *", // Every 5 minutes
      "command": "echo 'Hello, world!'",
      "conditions": {
        "exclusive": true,
        "remoteName": "^wsl(-.*)?$",
        "shell": "bash",
      }
    }
  ]
}
```

### Example

Using `winsomnia` to keep a remote machine awake:

```json
{
  "cron.tasks": [
    {
      "schedule": "*/2.5 * * * *", // Every 5 minutes
      "command": "winsomnia 5",
      "conditions": {
        "exclusive": false, // Run in every remote
      }
    }
  ]
}
```

## Extension Settings

This extension contributes the following settings:

* `cron.tasks`: Tasks to run on a schedule.
* `cron.debug`: Enables debug logging.

## Known Issues

## Release Notes

### 0.0.1

Initial release!
