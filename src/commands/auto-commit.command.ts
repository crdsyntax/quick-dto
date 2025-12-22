import * as vscode from "vscode";

export class AutoCommitService implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private enabled: boolean;

  constructor(private context: vscode.ExtensionContext) {
    this.enabled = !!this.context.globalState.get("autoCommitEnabled");
    this.registerCommands();
    this.registerListener();
  }

  private registerCommands() {
    this.disposables.push(
      vscode.commands.registerCommand("nest-tools.autoCommit", async () => {
        const git = await this.getGitApi();
        if (!git) {
          vscode.window.showWarningMessage("Git extension not available.");
          return;
        }
        const repo = await this.pickRepository(git);
        if (!repo) return;
        await this.runAutoCommitFlow(repo);
      })
    );

    this.disposables.push(
      vscode.commands.registerCommand(
        "nest-tools.enableAutoCommit",
        async () => {
          this.enabled = true;
          await this.context.globalState.update("autoCommitEnabled", true);
          vscode.window.showInformationMessage("Auto-commit enabled.");
          try {
            await this.initRepoMonitoring();
            await this.checkAllReposForThreshold();
          } catch (err) {
            // silent
          }
        }
      )
    );

    this.disposables.push(
      vscode.commands.registerCommand(
        "nest-tools.disableAutoCommit",
        async () => {
          this.enabled = false;
          await this.context.globalState.update("autoCommitEnabled", false);
          vscode.window.showInformationMessage("Auto-commit disabled.");
        }
      )
    );

    this.disposables.push(
      vscode.commands.registerCommand(
        "nest-tools.toggleAutoCommit",
        async () => {
          this.enabled = !this.enabled;
          await this.context.globalState.update(
            "autoCommitEnabled",
            this.enabled
          );
          vscode.window.showInformationMessage(
            `Auto-commit ${this.enabled ? "enabled" : "disabled"}.`
          );
          try {
            if (this.enabled) {
              await this.initRepoMonitoring();
              await this.checkAllReposForThreshold();
            }
          } catch (err) {
            // silent
          }
        }
      )
    );
  }

  private registerListener() {
    this.initRepoMonitoring().catch(() => {});
  }

  private repoStagedCount: Map<string, number> = new Map();
  private repoWorkingCount: Map<string, number> = new Map();

  private async initRepoMonitoring() {
    if ((this as any)._monitoringInitialized) return;
    (this as any)._monitoringInitialized = true;
    const git = await this.getGitApi();
    if (!git) return;

    const addRepoListener = (repo: any) => {
      try {
        const key = repo.rootUri?.fsPath || repo.path || String(Math.random());
        this.repoStagedCount.set(
          key,
          (repo.state.indexChanges || []).length || 0
        );
        this.repoWorkingCount.set(
          key,
          (repo.state.workingTreeChanges || []).length || 0
        );
        if (repo.state && typeof repo.state.onDidChange === "function") {
          const d = repo.state.onDidChange(() => this.onRepoStateChange(repo));
          this.disposables.push(d);
        } else if (typeof repo.onDidChange === "function") {
          const d = repo.onDidChange(() => this.onRepoStateChange(repo));
          this.disposables.push(d);
        } else {
          const interval = setInterval(
            () => this.onRepoStateChange(repo),
            1000
          );
          this.disposables.push({ dispose: () => clearInterval(interval) });
        }
      } catch (err) {
        // silent
      }
    };

    try {
      let attempts = 0;
      const maxAttempts = 8;
      while (attempts < maxAttempts) {
        const repos = git.repositories || [];
        if (repos.length > 0) {
          repos.forEach(addRepoListener);
          break;
        }
        attempts++;
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (err) {
      // silent
    }

    // listen for new repos if API exposes the event
    if (typeof git.onDidOpenRepository === "function") {
      try {
        const d = git.onDidOpenRepository((repo: any) => addRepoListener(repo));
        this.disposables.push(d);
      } catch (err) {
        // silent
      }
    }
  }

  private async checkAllReposForThreshold() {
    try {
      const git = await this.getGitApi();
      if (!git) return;
      const repos: any[] = git.repositories || [];
      if (repos.length === 0) return;
      let repoToCheck: any;
      if (repos.length === 1) {
        repoToCheck = repos[0];
      } else {
        const picks = repos.map((r) => ({ label: r.rootUri.fsPath, repo: r }));
        const sel = await vscode.window.showQuickPick(picks, {
          placeHolder:
            "Multiple repositories detected — select one to check for staged files",
        });
        if (!sel) return;
        repoToCheck = sel.repo;
      }

      const staged = (repoToCheck.state.indexChanges || []).length || 0;
      if (staged >= 3) {
        try {
          vscode.window.showInformationMessage(
            `Repository ${
              repoToCheck.rootUri?.fsPath || repoToCheck.path
            } has ${staged} staged files — running auto-commit flow.`
          );
        } catch (e) {
          // ignore
        }
        await this.runAutoCommitFlow(repoToCheck);
      }
    } catch (err) {
      // silent
    }
  }

  private async onRepoStateChange(repo: any) {
    try {
      if (!this.enabled) return;
      const key = repo.rootUri?.fsPath || repo.path || String(Math.random());

      const prevStaged = this.repoStagedCount.get(key) || 0;
      const currentStaged = (repo.state.indexChanges || []).length || 0;
      this.repoStagedCount.set(key, currentStaged);

      const prevWorking = this.repoWorkingCount.get(key) || 0;
      const currentWorking = (repo.state.workingTreeChanges || []).length || 0;
      this.repoWorkingCount.set(key, currentWorking);

      // Auto-stage logic: if working files >= 3 and it's a rising edge
      if (currentWorking >= 3 && prevWorking < 3) {
        try {
          vscode.window.showInformationMessage(
            `Detected ${currentWorking} changed files in ${
              repo.rootUri?.fsPath || repo.path
            }. Auto-staging...`
          );
        } catch (e) {}
        await this.stageFiles(repo, currentWorking);
        // After staging, repo state will change again and trigger onRepoStateChange
        // where it will hit the auto-commit logic below if currentStaged >= 3
        return;
      }

      // trigger only on rising edge when reaching threshold for commit
      if (currentStaged >= 3 && prevStaged < 3) {
        try {
          vscode.window.showInformationMessage(
            `Detected ${currentStaged} staged files in ${
              repo.rootUri?.fsPath || repo.path
            }. Starting auto-commit flow...`
          );
        } catch (e) {
          // ignore
        }
        await this.runAutoCommitFlow(repo);
      }
    } catch (err) {
      // silent
    }
  }

  private async getGitApi(): Promise<any | undefined> {
    try {
      const gitExt = vscode.extensions.getExtension("vscode.git");
      if (!gitExt) return undefined;
      try {
        if (!gitExt.isActive && typeof gitExt.activate === "function") {
          await gitExt.activate();
        }
      } catch (e) {
        // ignore
      }
      const git = gitExt.exports?.getAPI ? gitExt.exports.getAPI(1) : undefined;
      return git;
    } catch (err) {
      return undefined;
    }
  }

  private async pickRepository(git: any): Promise<any | undefined> {
    try {
      const repos: any[] = git.repositories || [];
      if (repos.length === 0) return undefined;
      if (repos.length === 1) return repos[0];
      const picks = repos.map((r) => ({ label: r.rootUri.fsPath, repo: r }));
      const sel = await vscode.window.showQuickPick(picks, {
        placeHolder: "Select repository for auto-commit",
      });
      return sel ? sel.repo : undefined;
    } catch (err) {
      return undefined;
    }
  }

  private isProtectedBranch(name?: string) {
    if (!name) return false;
    const p = ["dev", "develop", "developer", "main", "master"];
    return p.includes(name);
  }

  private makeBranchName() {
    const ts = Date.now();
    return `feat/auto-commit-${ts}`;
  }

  private async ensureNonProtectedBranch(repo: any): Promise<boolean> {
    try {
      const current = repo.state.HEAD?.name;
      if (!this.isProtectedBranch(current)) return true; // ok
      const defaultName = this.makeBranchName();
      const input = await vscode.window.showInputBox({
        prompt: `Current branch '${current}' is protected. Enter new branch name to create and switch to (or cancel):`,
        value: defaultName,
        ignoreFocusOut: true,
      });
      if (!input || input.trim().length === 0) {
        vscode.window.showWarningMessage(
          "Auto-commit aborted: branch creation cancelled."
        );
        return false;
      }
      const newName = input.trim();
      try {
        await repo.createBranch(newName, true);
      } catch (e) {
        // ignore create error
      }
      try {
        await repo.checkout(newName);
      } catch (e) {
        // ignore
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  private async stageFiles(repo: any, count = 3) {
    try {
      const working: any[] = repo.state.workingTreeChanges || [];
      if (!working || working.length === 0) return false;
      const toStage = working
        .slice(0, count)
        .map((c: any) => c.uri || c.resourceUri || c);
      if (toStage.length === 0) return false;
      try {
        // repo.add expects Uri[]
        if (typeof repo.add === "function") {
          await repo.add(toStage);
        } else if (typeof repo.addResource === "function") {
          await repo.addResource(toStage);
        } else {
          // no API to add; try staging via commands as fallback
          for (const u of toStage) {
            try {
              await vscode.commands.executeCommand("git.stage", u);
            } catch (e) {
              // ignore
            }
          }
        }
        try {
          vscode.window.showInformationMessage(
            `Staged ${toStage.length} file(s) for auto-commit.`
          );
        } catch (e) {
          // ignore
        }
        return true;
      } catch (err) {
        return false;
      }
    } catch (err) {
      return false;
    }
  }

  private commitMessageRegex = /^(fix|feat|chore|refactor): .+/;

  private async runAutoCommitFlow(repo: any) {
    try {
      if (!repo) return;
      // If there are >=3 working changes, auto-stage them first
      const stagedBefore = (repo.state.indexChanges || []).length || 0;
      const working = (repo.state.workingTreeChanges || []).length || 0;
      if (working >= 3 && stagedBefore < 3) {
        await this.stageFiles(repo, 3);
      }

      const staged = (repo.state.indexChanges || []).length || 0;
      if (staged < 3) return; // do nothing per rules

      const message = await vscode.window.showInputBox({
        prompt: "Ingrese el mensaje del commit (fix/feat/chore/refactor)",
        ignoreFocusOut: true,
        validateInput: (v) => {
          if (!v || v.trim().length === 0) return "Commit message required";
          if (!this.commitMessageRegex.test(v.trim()))
            return "Message must start with fix:, feat:, chore:, or refactor:";
          return undefined;
        },
      });

      if (!message) return; // canceled

      if (!this.commitMessageRegex.test(message.trim())) {
        vscode.window.showErrorMessage(
          "Invalid commit message format. Commit aborted."
        );
        return;
      }

      const ok = await this.ensureNonProtectedBranch(repo);
      if (!ok) return;

      try {
        await repo.commit(message.trim());
        vscode.window.showInformationMessage("Auto-commit completed.");
      } catch (err: any) {
        console.error("Auto-commit failed:", err?.message || err);
      }
    } catch (err) {
      // silent
    }
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}

export function createAutoCommitService(context: vscode.ExtensionContext) {
  return new AutoCommitService(context);
}
