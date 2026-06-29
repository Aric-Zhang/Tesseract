import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SEQUENCES } from "./workspace-sequence-config.mjs";

function createNpmInvocation(script, workspace) {
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath, "run", script, "-w", workspace]
    };
  }

  if (process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "npm", "run", script, "-w", workspace]
    };
  }

  return {
    command: "npm",
    args: ["run", script, "-w", workspace]
  };
}

export function runWorkspaceSequence(sequenceName) {
  const sequence = SEQUENCES[sequenceName];
  if (!sequence) {
    const names = Object.keys(SEQUENCES).join(", ");
    console.error(`[workspace-sequence] Unknown sequence "${sequenceName}". Expected one of: ${names}`);
    return 1;
  }

  for (const { workspace, script } of sequence) {
    console.log(`[workspace-sequence] ${workspace}: npm run ${script}`);
    const invocation = createNpmInvocation(script, workspace);
    const result = spawnSync(invocation.command, invocation.args, {
      stdio: "inherit"
    });

    if (result.error) {
      console.error(`[workspace-sequence] Failed to start ${workspace}:${script}`);
      console.error(result.error);
      return 1;
    }

    if (result.status !== 0) {
      return result.status ?? 1;
    }
  }

  return 0;
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (isMain) {
  const sequenceName = process.argv[2];
  process.exitCode = runWorkspaceSequence(sequenceName);
}
