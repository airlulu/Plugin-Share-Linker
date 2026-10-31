const { ButtonComponent, Notice, Plugin, PluginSettingTab, Setting } = require("obsidian");
const fs = require("fs");
const path = require("path");

const CONFIG_DIR_NAME = ".obsidian";
const PAGE_SIZES = [5, 10, 20, 50];
const TARGET_ACCESS_TIMEOUT_MS = 15000;
const SYMLINK_TIMEOUT_MS = 20000;
const ACTION_TIMEOUT_MS = 300000;

const DEFAULT_SETTINGS = {
  targetVaultPath: "",
  selectedPluginIds: [],
  enabledPluginIds: [],
  selectedThemeNames: [],
  targetThemeName: "",
  selectedSnippetNames: [],
  enabledSnippetNames: [],
  pageSize: 10,
  language: "zh",
};

const TEXT = {
  zh: {
    commandOpen: "打开共享面板",
    title: "共享面板",
    switchLanguage: "English",
    currentVault: "当前 Vault：",
    currentVaultUnknown: "无法识别当前 Vault 路径",
    targetVaultName: "目标 Vault 路径 A",
    targetVaultDesc: "填写另一个 Obsidian Vault 的文件夹路径。插件、主题与 CSS 片段都写入这一个库。",
    targetVaultHint: "如果该目录还不是 Obsidian 库，共享会在其中创建 .obsidian 目录。",
    refresh: "刷新",
    refreshTitle: "重新读取当前 Vault 的插件、主题与片段列表",
    selectAll: "全选",
    selectAllTitle: "选择当前列表中的全部插件（含所有分页），并默认勾选启用",
    clear: "取消全选",
    clearTitle: "取消所有已选插件与启用勾选",
    copy: "复制",
    copyTitle: "将选中的项目完整复制到目标 Vault",
    symlink: "软连接",
    symlinkTitle: "将选中的项目以软链接方式连接到目标 Vault",
    sectionPlugins: "插件",
    sectionThemes: "主题",
    sectionSnippets: "CSS 片段",
    pluginsCount: (total, selected, page, totalPages) => `已发现 ${total} 个插件，已选择 ${selected} 个。当前第 ${page} / ${totalPages} 页。`,
    themesCount: (total, selected) => `已发现 ${total} 个主题，已选择 ${selected} 个。`,
    snippetsCount: (total, selected) => `已发现 ${total} 个片段，已选择 ${selected} 个。`,
    listReadFailed: (message) => `读取资源列表失败：${message}`,
    previousPage: "上一页",
    nextPage: "下一页",
    pageInfo: (page, totalPages) => `第 ${page} / ${totalPages} 页`,
    pageSizePrefix: "每页",
    pageSizeSuffix: "个",
    busyProgress: (label, seconds) => `${label}（已等待 ${seconds} 秒）`,
    targetAccessTimeout: (seconds, targetPath) =>
      `目标路径 ${seconds} 秒内没有响应：${targetPath}。请确认它是本地可访问的文件夹——网络盘、云盘占位文件或已断开的移动硬盘会长时间无响应。`,
    symlinkTimeout: (seconds, name) => `为 ${name} 创建软链接超过 ${seconds} 秒，已停止等待。目标路径可能不可访问。`,
    actionTimeout: (seconds) =>
      `操作超过 ${seconds} 秒仍未完成，已停止等待。请检查目标路径是否可访问（网络盘 / 云盘占位文件常见），或改用软链接模式避免复制大文件。复制模式下文件可能仍在后台写入，稍后重试会显示“已存在”。`,
    checkTarget: "检查目标路径",
    checkTargetTitle: "验证目标路径是否存在、是否为 Obsidian 库、是否可写",
    checkingTarget: "正在检查目标路径...",
    targetCheckExists: "存在且是文件夹",
    targetCheckVault: "是 Obsidian 库（找到 .obsidian）",
    targetCheckWritable: "文件夹可写",
    targetCheckElapsed: (ms) => `耗时：${ms} ms`,
    targetCheckHint: "若这里显示正常但共享动作仍然卡住，请把下方的调试轨迹截图反馈。",
    targetCheckLine: (label, value) => `${label}：${value}`,
    yes: "是",
    no: "否",
    debugTrailTitle: "调试轨迹（动作卡住时截图这一段即可）",
    debugLogPath: (path) => `日志文件：${path}`,
    emptyPlugins: "当前 Vault 未发现可共享插件。",
    emptyThemes: "当前 Vault 未发现可共享主题。",
    emptySnippets: "当前 Vault 未发现可共享 CSS 片段。",
    emptyThemeRadio: "勾选主题后可在这里指定目标库当前主题。",
    noVersion: "未标注版本",
    share: "共享",
    enable: "启用",
    pluginEnableHint:
      "勾选“启用”会把插件 ID 追加到目标库 .obsidian/community-plugins.json：写前备份为 .bak，再临时文件 + rename 原子写；只启用成功落到目标库的插件；只追加、不删除。取消勾选不会停用目标库已启用的插件。",
    snippetEnableHint: "勾选“启用”会把片段名追加到目标库 .obsidian/appearance.json 的 enabledCssSnippets：只追加、不删除。",
    themeRadioTitle: "设为目标库当前主题",
    themeRadioNone: "不设置",
    themeRadioHint:
      "显式选中会覆盖目标库已有主题（appearance.json 的 cssTheme）；不选时，只有目标库没有自定义主题、且本次只共享一个主题，才自动设为该主题。",
    copying: "正在复制...",
    linking: "正在添加软链接...",
    copyNotice: (count) => `复制完成：新建 ${count} 项。`,
    linkNotice: (count) => `软链接完成：新建 ${count} 项。`,
    shareFailed: (message) => `共享失败：${message}`,
    copySummary: (created, exists, conflict, error) => `复制 ${created}，已存在 ${exists}，冲突 ${conflict}，失败 ${error}。`,
    linkSummary: (created, linked, exists, conflict, error) =>
      `新建 ${created}，已连接 ${linked}，已存在 ${exists}，冲突 ${conflict}，失败 ${error}。`,
    resultLine: (name, status) => `${name}：${status}`,
    resultsTitle: "共享结果",
    resultsPlugins: "插件",
    resultsThemes: "主题",
    resultsSnippets: "CSS 片段",
    configEnableLine: (plugins, snippets) => `目标库启用：新增 ${plugins} 个插件、${snippets} 个片段。`,
    configThemeLine: (theme) => `目标库当前主题：已设为 ${theme}。`,
    configThemeUnchanged: "目标库当前主题：未改动。",
    targetCreatedVault: "目标目录之前不是 Obsidian 库，已创建 .obsidian 目录。",
    restartHint: "目标库重启 Obsidian（或 Ctrl/Cmd+R）后生效。",
    configParseWarning: (file) => `${file} 不是有效的 JSON，已备份原文件后按空内容处理。`,
    backupMade: (file) => `已备份原文件：${file}`,
    targetRequired: "请输入目标 Obsidian Vault 路径。",
    targetInvalid: "目标路径不存在，或不是一个文件夹。",
    targetIsCurrent: "目标 Vault 不能是当前 Vault。",
    selectPluginRequired: "请至少选择一个插件。",
    selectThemeRequired: "请至少选择一个主题。",
    selectSnippetRequired: "请至少选择一个 CSS 片段。",
    alreadyLinked: "目标位置已经是指向当前项的软链接。",
    linkConflict: (target) => `目标位置已有软链接，但指向 ${target}。`,
    existsSkipped: "目标位置已有同名文件夹或文件，已跳过（未更新）。",
    copySymlinkConflict: "目标位置已有同名软链接，已跳过复制。",
    copyExistsSkipped: "目标位置已有同名文件夹或文件，已跳过复制（未更新）。",
    "status.created": "已创建",
    "status.linked": "已连接",
    "status.exists": "已存在（未更新）",
    "status.conflict": "冲突",
    "status.error": "失败",
  },
  en: {
    commandOpen: "Open share panel",
    title: "Share Panel",
    switchLanguage: "中文",
    currentVault: "Current Vault:",
    currentVaultUnknown: "Unable to detect current vault path",
    targetVaultName: "Target Vault Path A",
    targetVaultDesc: "Enter another Obsidian vault folder. Plugins, themes and CSS snippets are written into that vault.",
    targetVaultHint: "If the folder is not an Obsidian vault yet, .obsidian will be created there.",
    refresh: "Refresh",
    refreshTitle: "Reload plugins, themes and snippets from the current vault",
    selectAll: "Select All",
    selectAllTitle: "Select every plugin in the list (across pages) and enable them by default",
    clear: "Clear",
    clearTitle: "Clear all selected plugins and their enable flags",
    copy: "Copy",
    copyTitle: "Copy the selected items into the target vault",
    symlink: "Symlink",
    symlinkTitle: "Create symbolic links for the selected items in the target vault",
    sectionPlugins: "Plugins",
    sectionThemes: "Themes",
    sectionSnippets: "CSS snippets",
    pluginsCount: (total, selected, page, totalPages) => `${total} plugins found, ${selected} selected. Page ${page} / ${totalPages}.`,
    themesCount: (total, selected) => `${total} themes found, ${selected} selected.`,
    snippetsCount: (total, selected) => `${total} snippets found, ${selected} selected.`,
    listReadFailed: (message) => `Failed to read resource list: ${message}`,
    previousPage: "Previous",
    nextPage: "Next",
    pageInfo: (page, totalPages) => `Page ${page} / ${totalPages}`,
    pageSizePrefix: "Per page",
    pageSizeSuffix: "",
    busyProgress: (label, seconds) => `${label} (waited ${seconds}s)`,
    targetAccessTimeout: (seconds, targetPath) =>
      `The target path did not respond within ${seconds}s: ${targetPath}. Make sure it is a locally reachable folder — network drives, cloud placeholder files or disconnected external disks can hang.`,
    symlinkTimeout: (seconds, name) =>
      `Creating the symlink for ${name} took longer than ${seconds}s; stopped waiting. The target path may be unreachable.`,
    actionTimeout: (seconds) =>
      `The operation did not finish within ${seconds}s and was stopped. Check that the target path is reachable (network drives and cloud placeholders commonly hang), or use Symlink mode to avoid copying large files. In Copy mode files may still be written in the background; retrying later will report them as existing.`,
    checkTarget: "Check target path",
    checkTargetTitle: "Verify that the target path exists, is an Obsidian vault, and is writable",
    checkingTarget: "Checking target path...",
    targetCheckExists: "Exists and is a folder",
    targetCheckVault: "Is an Obsidian vault (.obsidian found)",
    targetCheckWritable: "Folder is writable",
    targetCheckElapsed: (ms) => `Took ${ms} ms`,
    targetCheckHint: "If this looks fine but sharing still stalls, screenshot the debug trail below.",
    targetCheckLine: (label, value) => `${label}: ${value}`,
    yes: "Yes",
    no: "No",
    debugTrailTitle: "Debug trail (screenshot this if an action stalls)",
    debugLogPath: (path) => `Log file: ${path}`,
    emptyPlugins: "No shareable plugins were found in the current vault.",
    emptyThemes: "No shareable themes were found in the current vault.",
    emptySnippets: "No shareable CSS snippets were found in the current vault.",
    emptyThemeRadio: "Select themes to pick the target vault's current theme here.",
    noVersion: "No version",
    share: "Share",
    enable: "Enable",
    pluginEnableHint:
      "Enabling appends plugin IDs to the target vault's .obsidian/community-plugins.json: the file is backed up to .bak and replaced atomically; only plugins that landed in the target are enabled; entries are appended, never removed. Unchecking does not disable an already-enabled plugin in the target vault.",
    snippetEnableHint: "Enabling appends snippet names to the target vault's .obsidian/appearance.json enabledCssSnippets: appended, never removed.",
    themeRadioTitle: "Set as target vault's current theme",
    themeRadioNone: "Do not set",
    themeRadioHint:
      "An explicit pick overrides the target vault's theme (cssTheme in appearance.json). When nothing is picked, the theme is set automatically only if the target has no custom theme and exactly one theme is shared.",
    copying: "Copying...",
    linking: "Creating symlinks...",
    copyNotice: (count) => `Copy complete: ${count} item(s) created.`,
    linkNotice: (count) => `Symlink complete: ${count} item(s) created.`,
    shareFailed: (message) => `Share failed: ${message}`,
    copySummary: (created, exists, conflict, error) => `Copied ${created}, exists ${exists}, conflicts ${conflict}, failed ${error}.`,
    linkSummary: (created, linked, exists, conflict, error) =>
      `Created ${created}, already linked ${linked}, exists ${exists}, conflicts ${conflict}, failed ${error}.`,
    resultLine: (name, status) => `${name}: ${status}`,
    resultsTitle: "Share results",
    resultsPlugins: "Plugins",
    resultsThemes: "Themes",
    resultsSnippets: "CSS snippets",
    configEnableLine: (plugins, snippets) => `Target vault enabled: ${plugins} plugin(s), ${snippets} snippet(s) added.`,
    configThemeLine: (theme) => `Target vault theme: set to ${theme}.`,
    configThemeUnchanged: "Target vault theme: unchanged.",
    targetCreatedVault: "The target folder was not a vault; .obsidian was created.",
    restartHint: "Restart Obsidian in the target vault (or press Ctrl/Cmd+R) to apply.",
    configParseWarning: (file) => `${file} is not valid JSON; the original file was backed up and treated as empty.`,
    backupMade: (file) => `Original backed up to: ${file}`,
    targetRequired: "Enter a target Obsidian vault path.",
    targetInvalid: "The target path does not exist, or is not a folder.",
    targetIsCurrent: "The target vault cannot be the current vault.",
    selectPluginRequired: "Select at least one plugin.",
    selectThemeRequired: "Select at least one theme.",
    selectSnippetRequired: "Select at least one CSS snippet.",
    alreadyLinked: "The target already points to this item.",
    linkConflict: (target) => `The target already has a symlink pointing to ${target}.`,
    existsSkipped: "A folder or file with the same name already exists at the target. Skipped (not updated).",
    copySymlinkConflict: "A symlink with the same name already exists at the target. Copy skipped.",
    copyExistsSkipped: "A folder or file with the same name already exists at the target. Copy skipped (not updated).",
    "status.created": "Created",
    "status.linked": "Linked",
    "status.exists": "Exists (not updated)",
    "status.conflict": "Conflict",
    "status.error": "Failed",
  },
};

module.exports = class PluginShareLinker extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) || {});
    this.normalizeSettings();
    this.debugTrail = [];
    this.actionStartedAt = 0;
    this.addSettingTab(new PluginShareLinkerSettingTab(this.app, this));

    this.beginDebugSession(`onload v${this.manifest.version}`);
    this.debug("onload", `plugin v${this.manifest.version} obsidian=${(this.app && this.app.version) || "?"}`);

    if (typeof window !== "undefined") {
      this.registerDomEvent(window, "unhandledrejection", (event) => {
        const reason = event && event.reason;
        this.debug("unhandled-rejection", String((reason && (reason.stack || reason.message)) || reason));
      });
      this.registerDomEvent(window, "error", (event) => {
        this.debug("window-error", String((event && (event.message || event.error)) || event));
      });
    }

    this.addCommand({
      id: "open-plugin-share-linker",
      name: this.t("commandOpen"),
      callback: () => this.openSettings(),
    });
  }

  debug(label, detail) {
    const entry = {
      at: Date.now(),
      label,
      detail: typeof detail === "string" ? detail : JSON.stringify(detail),
    };
    this.debugTrail.push(entry);
    if (this.debugTrail.length > 120) this.debugTrail.shift();
    logDebug(label, detail);
    this.appendDebugLog(entry);
  }

  getDebugLogPath() {
    const vaultPath = this.getCurrentVaultPath();
    if (!vaultPath) return "";
    return path.join(vaultPath, this.getConfigDir(), "plugins", this.manifest.id, "debug.log");
  }

  appendDebugLog(entry) {
    const filePath = this.getDebugLogPath();
    if (!filePath) return;
    const offset = entry.at - (this.actionStartedAt || entry.at);
    const line = `+${String(offset).padStart(6, " ")}ms [${entry.label}] ${entry.detail}\n`;
    try {
      // 同步写：卡住时保证最后一条日志已经落盘，这是诊断的关键。
      fs.appendFileSync(filePath, line, "utf8");
    } catch (error) {
      // logging must never break sharing
    }
  }

  beginDebugSession(title) {
    this.debugTrail = [];
    this.actionStartedAt = Date.now();
    const filePath = this.getDebugLogPath();
    if (!filePath) return;
    const header = `=== ${new Date().toISOString()} ${title} (v${this.manifest.version}) pid=${process.pid}\n`;
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      let size = 0;
      try {
        size = fs.statSync(filePath).size;
      } catch (error) {
        size = 0;
      }
      if (size > 200 * 1024) {
        fs.writeFileSync(filePath, header, "utf8");
      } else {
        fs.appendFileSync(filePath, header, "utf8");
      }
    } catch (error) {
      // logging must never break sharing
    }
  }

  normalizeSettings() {
    const settings = this.settings;
    settings.language = settings.language === "en" ? "en" : "zh";
    settings.pageSize = normalizePageSize(Number(settings.pageSize));
    settings.targetVaultPath = typeof settings.targetVaultPath === "string" ? settings.targetVaultPath : "";
    settings.targetThemeName = typeof settings.targetThemeName === "string" ? settings.targetThemeName : "";
    settings.selectedPluginIds = normalizeStringArray(settings.selectedPluginIds);
    settings.enabledPluginIds = normalizeStringArray(settings.enabledPluginIds);
    settings.selectedThemeNames = normalizeStringArray(settings.selectedThemeNames);
    settings.selectedSnippetNames = normalizeStringArray(settings.selectedSnippetNames);
    settings.enabledSnippetNames = normalizeStringArray(settings.enabledSnippetNames);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  t(key, ...args) {
    const messages = TEXT[this.settings.language] || TEXT.zh;
    const fallback = TEXT.zh[key] || key;
    const value = messages[key] || fallback;
    return typeof value === "function" ? value(...args) : value;
  }

  openSettings() {
    if (this.app.setting) {
      this.app.setting.open();
      this.app.setting.openTabById(this.manifest.id);
    }
  }

  getCurrentVaultPath() {
    const adapter = this.app.vault.adapter;
    if (adapter && typeof adapter.getBasePath === "function") {
      return adapter.getBasePath();
    }
    return "";
  }

  getConfigDir() {
    return this.app.vault.configDir || CONFIG_DIR_NAME;
  }

  getCurrentPluginsPath() {
    const vaultPath = this.getCurrentVaultPath();
    if (!vaultPath) return "";
    return path.join(vaultPath, this.getConfigDir(), "plugins");
  }

  getCurrentThemesPath() {
    const vaultPath = this.getCurrentVaultPath();
    if (!vaultPath) return "";
    return path.join(vaultPath, this.getConfigDir(), "themes");
  }

  getCurrentSnippetsPath() {
    const vaultPath = this.getCurrentVaultPath();
    if (!vaultPath) return "";
    return path.join(vaultPath, this.getConfigDir(), "snippets");
  }

  async listPlugins() {
    const pluginsPath = this.getCurrentPluginsPath();
    if (!pluginsPath) return [];

    const entries = await readDirSafe(pluginsPath);
    const plugins = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === this.manifest.id || entry.name.startsWith(".")) continue;

      const pluginPath = path.join(pluginsPath, entry.name);
      const manifestPath = path.join(pluginPath, "manifest.json");
      let manifest = {};

      try {
        manifest = JSON.parse(await fs.promises.readFile(manifestPath, "utf8"));
      } catch (error) {
        continue;
      }

      plugins.push({
        id: manifest.id || entry.name,
        folderName: entry.name,
        name: manifest.name || entry.name,
        version: manifest.version || "",
        description: manifest.description || "",
        sourcePath: pluginPath,
      });
    }

    return plugins.sort(compareByName);
  }

  async listThemes() {
    const themesPath = this.getCurrentThemesPath();
    if (!themesPath) return [];

    const entries = await readDirSafe(themesPath);
    const themes = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

      const themePath = path.join(themesPath, entry.name);
      if (!(await isFile(path.join(themePath, "theme.css")))) continue;

      let manifest = null;
      try {
        manifest = JSON.parse(await fs.promises.readFile(path.join(themePath, "manifest.json"), "utf8"));
      } catch (error) {
        manifest = null;
      }

      themes.push({
        folderName: entry.name,
        name: (manifest && manifest.name) || entry.name,
        version: (manifest && manifest.version) || "",
        sourcePath: themePath,
      });
    }

    return themes.sort(compareByName);
  }

  async listSnippets() {
    const snippetsPath = this.getCurrentSnippetsPath();
    if (!snippetsPath) return [];

    const entries = await readDirSafe(snippetsPath);
    const snippets = [];

    for (const entry of entries) {
      if (!entry.isFile() || entry.name.startsWith(".") || !/\.css$/i.test(entry.name)) continue;

      snippets.push({
        name: entry.name.replace(/\.css$/i, ""),
        fileName: entry.name,
        sourcePath: path.join(snippetsPath, entry.name),
      });
    }

    return snippets.sort(compareByName);
  }

  async resolveTargetVault(targetVaultPath) {
    const normalized = normalizePathInput(targetVaultPath);
    if (!normalized) throw new Error(this.t("targetRequired"));

    this.debug("target", `start ${normalized}`);
    let stats = null;
    try {
      stats = await runWithTimeout(
        () => fs.promises.stat(normalized),
        TARGET_ACCESS_TIMEOUT_MS,
        this.t("targetAccessTimeout", Math.round(TARGET_ACCESS_TIMEOUT_MS / 1000), normalized)
      );
    } catch (error) {
      this.debug("target", `stat failed: ${error && error.message}`);
      if (error && (error.code === "ENOENT" || error.code === "ENOTDIR")) {
        throw new Error(this.t("targetInvalid"));
      }
      throw error;
    }

    if (!stats || !stats.isDirectory()) throw new Error(this.t("targetInvalid"));
    this.debug("target", `stat ok, isDirectory`);

    const currentVaultPath = this.getCurrentVaultPath();
    if (currentVaultPath && path.resolve(normalized) === path.resolve(currentVaultPath)) {
      throw new Error(this.t("targetIsCurrent"));
    }

    const configDir = path.join(normalized, CONFIG_DIR_NAME);
    let isVault = false;
    try {
      const configStats = await runWithTimeout(
        () => fs.promises.stat(configDir),
        TARGET_ACCESS_TIMEOUT_MS,
        this.t("targetAccessTimeout", Math.round(TARGET_ACCESS_TIMEOUT_MS / 1000), configDir)
      );
      isVault = !!configStats && configStats.isDirectory();
    } catch (error) {
      if (error && (error.code === "ENOENT" || error.code === "ENOTDIR")) {
        isVault = false;
      } else {
        this.debug("target", `config stat failed: ${error && error.message}`);
        throw error;
      }
    }

    this.debug("target", `resolved isVault=${isVault}`);
    logDebug("target resolved", { targetPath: normalized, configDir, isVault });
    return { targetPath: normalized, configDir, isVault };
  }

  async inspectTarget(targetVaultPath) {
    const startedAt = Date.now();
    this.debug("check", "resolve target start");
    const target = await this.resolveTargetVault(targetVaultPath);
    this.debug("check", `resolve target done vault=${target.isVault}`);
    const probePath = path.join(target.targetPath, `.plugin-share-linker-probe-${Date.now()}`);
    let writable = false;

    this.debug("check", `probe write start ${probePath}`);
    try {
      await runWithTimeout(
        () => fs.promises.writeFile(probePath, "probe", "utf8"),
        TARGET_ACCESS_TIMEOUT_MS,
        this.t("targetAccessTimeout", Math.round(TARGET_ACCESS_TIMEOUT_MS / 1000), probePath)
      );
      writable = true;
      this.debug("check", "probe write done");
    } catch (error) {
      this.debug("check", `write probe failed: ${error && error.message}`);
    }

    this.debug("check", "probe cleanup start");
    try {
      await fs.promises.rm(probePath, { force: true });
      this.debug("check", "probe cleanup done");
    } catch (error) {
      this.debug("check", `probe cleanup failed: ${error && error.message}`);
    }

    const elapsedMs = Date.now() - startedAt;
    this.debug("check", `done writable=${writable} elapsed=${elapsedMs}ms`);
    return { target, writable, elapsedMs };
  }

  async sharePlugins(pluginIds, targetVaultPath, mode) {
    const target = await this.resolveTargetVault(targetVaultPath);
    const selected = new Set(pluginIds);
    const plugins = (await this.listPlugins()).filter((plugin) => selected.has(plugin.id));

    if (plugins.length === 0) throw new Error(this.t("selectPluginRequired"));

    const pluginsPath = path.join(target.configDir, "plugins");
    await fs.promises.mkdir(pluginsPath, { recursive: true });

    const results = [];
    this.debug("plugins", `start mode=${mode} count=${plugins.length}`);
    for (const plugin of plugins) {
      const targetPath = path.join(pluginsPath, plugin.folderName);
      results.push(await shareEntry(plugin, targetPath, mode, "dir", this.t.bind(this), this.debug.bind(this)));
    }
    this.debug("plugins", results.map((result) => `${result.entry.name}:${result.status}`).join(", "));
    logDebug("share plugins", { mode, target: target.configDir, count: plugins.length });

    const landedIds = results.filter((result) => isLanded(result.status)).map((result) => result.entry.id);
    const enabledIds = this.settings.enabledPluginIds.filter((id) => landedIds.includes(id));
    const config = enabledIds.length
      ? await this.writeTargetConfig(target.configDir, { pluginIds: enabledIds }, this.t.bind(this))
      : null;

    return { results, config, target };
  }

  async shareThemes(themeNames, targetVaultPath, mode) {
    const target = await this.resolveTargetVault(targetVaultPath);
    const selected = new Set(themeNames);
    const themes = (await this.listThemes()).filter((theme) => selected.has(theme.folderName));

    if (themes.length === 0) throw new Error(this.t("selectThemeRequired"));

    const themesPath = path.join(target.configDir, "themes");
    await fs.promises.mkdir(themesPath, { recursive: true });

    const results = [];
    this.debug("themes", `start mode=${mode} count=${themes.length}`);
    for (const theme of themes) {
      const targetPath = path.join(themesPath, theme.folderName);
      results.push(await shareEntry(theme, targetPath, mode, "dir", this.t.bind(this), this.debug.bind(this)));
    }
    this.debug("themes", results.map((result) => `${result.entry.name}:${result.status}`).join(", "));
    logDebug("share themes", { mode, target: target.configDir, count: themes.length });

    const landedThemes = results.filter((result) => isLanded(result.status)).map((result) => result.entry);
    const themeName = await this.resolveTargetTheme(target, landedThemes);
    const config = themeName ? await this.writeTargetConfig(target.configDir, { themeName }, this.t.bind(this)) : null;

    return { results, config, target };
  }

  async shareSnippets(snippetNames, targetVaultPath, mode) {
    const target = await this.resolveTargetVault(targetVaultPath);
    const selected = new Set(snippetNames);
    const snippets = (await this.listSnippets()).filter((snippet) => selected.has(snippet.name));

    if (snippets.length === 0) throw new Error(this.t("selectSnippetRequired"));

    const snippetsPath = path.join(target.configDir, "snippets");
    await fs.promises.mkdir(snippetsPath, { recursive: true });

    const results = [];
    this.debug("snippets", `start mode=${mode} count=${snippets.length}`);
    for (const snippet of snippets) {
      const targetPath = path.join(snippetsPath, snippet.fileName);
      results.push(await shareEntry(snippet, targetPath, mode, "file", this.t.bind(this), this.debug.bind(this)));
    }
    this.debug("snippets", results.map((result) => `${result.entry.name}:${result.status}`).join(", "));
    logDebug("share snippets", { mode, target: target.configDir, count: snippets.length });

    const landedNames = results.filter((result) => isLanded(result.status)).map((result) => result.entry.name);
    const enabledNames = this.settings.enabledSnippetNames.filter((name) => landedNames.includes(name));
    const config = enabledNames.length
      ? await this.writeTargetConfig(target.configDir, { snippetNames: enabledNames }, this.t.bind(this))
      : null;

    return { results, config, target };
  }

  async createLinks(pluginIds, targetVaultPath) {
    return this.sharePlugins(pluginIds, targetVaultPath, "symlink");
  }

  async copyPlugins(pluginIds, targetVaultPath) {
    return this.sharePlugins(pluginIds, targetVaultPath, "copy");
  }

  async createThemeLinks(themeNames, targetVaultPath) {
    return this.shareThemes(themeNames, targetVaultPath, "symlink");
  }

  async copyThemes(themeNames, targetVaultPath) {
    return this.shareThemes(themeNames, targetVaultPath, "copy");
  }

  async createSnippetLinks(snippetNames, targetVaultPath) {
    return this.shareSnippets(snippetNames, targetVaultPath, "symlink");
  }

  async copySnippets(snippetNames, targetVaultPath) {
    return this.shareSnippets(snippetNames, targetVaultPath, "copy");
  }

  async resolveTargetTheme(target, landedThemes) {
    const explicitTheme = this.settings.targetThemeName;
    if (explicitTheme) {
      return landedThemes.some((theme) => theme.folderName === explicitTheme) ? explicitTheme : null;
    }

    if (landedThemes.length !== 1) return null;

    const appearanceFile = path.join(target.configDir, "appearance.json");
    const { value } = await readJsonFile(appearanceFile, {});
    const currentTheme = isPlainObject(value) && typeof value.cssTheme === "string" ? value.cssTheme.trim() : "";
    if (currentTheme) return null;

    return landedThemes[0].folderName;
  }

  async writeTargetConfig(configDir, changes) {
    const summary = { pluginsEnabled: [], snippetsEnabled: [], themeSet: null, warnings: [], backups: [] };

    if (Array.isArray(changes.pluginIds) && changes.pluginIds.length) {
      const result = await writeCommunityPlugins(configDir, changes.pluginIds, this.t.bind(this), this.debug.bind(this));
      summary.pluginsEnabled = result.added;
      summary.warnings.push(...result.warnings);
      if (result.backupPath) summary.backups.push(result.backupPath);
    }

    if ((Array.isArray(changes.snippetNames) && changes.snippetNames.length) || changes.themeName) {
      const result = await writeAppearanceConfig(
        configDir,
        { snippetNames: changes.snippetNames || [], themeName: changes.themeName || "" },
        this.t.bind(this),
        this.debug.bind(this)
      );
      summary.snippetsEnabled = result.snippetsAdded;
      summary.themeSet = result.themeSet;
      summary.warnings.push(...result.warnings);
      if (result.backupPath) summary.backups.push(result.backupPath);
    }

    if (summary.pluginsEnabled.length > 0) this.debug("config", `plugins +${summary.pluginsEnabled.length}`);
    if (summary.snippetsEnabled.length > 0) this.debug("config", `snippets +${summary.snippetsEnabled.length}`);
    if (summary.themeSet) this.debug("config", `theme ${summary.themeSet}`);
    if (summary.warnings.length > 0) this.debug("config", `warnings ${summary.warnings.length}`);

    if (
      summary.pluginsEnabled.length === 0 &&
      summary.snippetsEnabled.length === 0 &&
      !summary.themeSet &&
      summary.warnings.length === 0
    ) {
      return null;
    }

    logDebug("target config written", summary);
    return summary;
  }
};

class PluginShareLinkerSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.plugins = [];
    this.themes = [];
    this.snippets = [];
    this.currentPage = 1;
    this.actionResults = { plugins: null, themes: null, snippets: null };
    this.configState = { pluginsEnabled: [], snippetsEnabled: [], themeSet: null };
    this.warnings = [];
    this.notes = [];
    this.themeActionSeen = false;
    this.busy = false;
  }

  async display() {
    const { containerEl } = this;
    const t = this.plugin.t.bind(this.plugin);
    this.busy = false;
    containerEl.empty();
    containerEl.addClass("plugin-share-linker-settings");

    const headerEl = containerEl.createDiv("plugin-share-linker-header");
    headerEl.createEl("h2", { text: t("title") });
    headerEl.createSpan({ cls: "plugin-share-linker-version", text: `v${this.plugin.manifest.version}` });
    const languageButton = new ButtonComponent(headerEl)
      .setIcon("languages")
      .onClick(async () => {
        this.plugin.settings.language = this.plugin.settings.language === "en" ? "zh" : "en";
        await this.plugin.saveSettings();
        this.display();
      });
    setToolbarButtonLabel(languageButton, t("switchLanguage"), t("switchLanguage"));

    const currentVault = this.plugin.getCurrentVaultPath();
    const currentInfo = containerEl.createDiv("plugin-share-linker-current");
    currentInfo.createSpan({ text: t("currentVault") });
    currentInfo.createEl("code", { text: currentVault || t("currentVaultUnknown") });

    new Setting(containerEl)
      .setName(t("targetVaultName"))
      .setDesc(t("targetVaultDesc"))
      .addText((text) => {
        text
          .setPlaceholder("/Users/sean/Documents/Another Vault")
          .setValue(this.plugin.settings.targetVaultPath)
          .onChange(async (value) => {
            this.plugin.settings.targetVaultPath = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.addClass("plugin-share-linker-path-input");
      });
    containerEl.createDiv("plugin-share-linker-hint").setText(t("targetVaultHint"));

    const targetToolsEl = containerEl.createDiv("plugin-share-linker-target-tools");
    const checkButton = new ButtonComponent(targetToolsEl)
      .setIcon("search")
      .onClick(() => this.checkTargetPath());
    setToolbarButtonLabel(checkButton, t("checkTarget"), t("checkTargetTitle"));

    this.buildPluginsSection(containerEl);
    this.buildThemesSection(containerEl);
    this.buildSnippetsSection(containerEl);

    this.resultsEl = containerEl.createDiv("plugin-share-linker-results");

    await this.refreshAll();
  }

  buildPluginsSection(containerEl) {
    const t = this.plugin.t.bind(this.plugin);
    const section = createSection(containerEl, t("sectionPlugins"));
    this.pluginsCountEl = section.bodyEl.createDiv("plugin-share-linker-count");
    this.pluginsToolbarEl = section.bodyEl.createDiv("plugin-share-linker-toolbar");
    this.pluginsPaginationEl = section.bodyEl.createDiv("plugin-share-linker-pagination");
    this.pluginsListEl = section.bodyEl.createDiv("plugin-share-linker-list");
    section.bodyEl.createDiv("plugin-share-linker-hint").setText(t("pluginEnableHint"));

    const refreshButton = new ButtonComponent(this.pluginsToolbarEl)
      .setIcon("refresh-cw")
      .onClick(() => this.refreshAll());
    setToolbarButtonLabel(refreshButton, t("refresh"), t("refreshTitle"));

    const selectAllButton = new ButtonComponent(this.pluginsToolbarEl)
      .setIcon("check-square")
      .onClick(async () => {
        this.plugin.settings.selectedPluginIds = this.plugins.map((plugin) => plugin.id);
        this.plugin.settings.enabledPluginIds = this.plugins.map((plugin) => plugin.id);
        await this.plugin.saveSettings();
        this.renderPlugins();
      });
    setToolbarButtonLabel(selectAllButton, t("selectAll"), t("selectAllTitle"));

    const clearButton = new ButtonComponent(this.pluginsToolbarEl)
      .setIcon("square")
      .onClick(async () => {
        this.plugin.settings.selectedPluginIds = [];
        this.plugin.settings.enabledPluginIds = [];
        await this.plugin.saveSettings();
        this.renderPlugins();
      });
    setToolbarButtonLabel(clearButton, t("clear"), t("clearTitle"));

    this.addActionButtons(this.pluginsToolbarEl, "plugins");
  }

  buildThemesSection(containerEl) {
    const t = this.plugin.t.bind(this.plugin);
    const section = createSection(containerEl, t("sectionThemes"));
    this.themesCountEl = section.bodyEl.createDiv("plugin-share-linker-count");
    this.themesToolbarEl = section.bodyEl.createDiv("plugin-share-linker-toolbar");
    this.themesListEl = section.bodyEl.createDiv("plugin-share-linker-list");

    const radioEl = section.bodyEl.createDiv("plugin-share-linker-radio");
    this.themesRadioEl = radioEl;

    section.bodyEl.createDiv("plugin-share-linker-hint").setText(t("themeRadioHint"));

    this.addActionButtons(this.themesToolbarEl, "themes");
  }

  buildSnippetsSection(containerEl) {
    const t = this.plugin.t.bind(this.plugin);
    const section = createSection(containerEl, t("sectionSnippets"));
    this.snippetsCountEl = section.bodyEl.createDiv("plugin-share-linker-count");
    this.snippetsToolbarEl = section.bodyEl.createDiv("plugin-share-linker-toolbar");
    this.snippetsListEl = section.bodyEl.createDiv("plugin-share-linker-list");
    section.bodyEl.createDiv("plugin-share-linker-hint").setText(t("snippetEnableHint"));

    this.addActionButtons(this.snippetsToolbarEl, "snippets");
  }

  addActionButtons(containerEl, kind) {
    const t = this.plugin.t.bind(this.plugin);
    const copyButton = new ButtonComponent(containerEl)
      .setIcon("copy")
      .onClick(async () => {
        await this.runShareAction(kind, "copy");
      });
    copyButton.buttonEl.addClass("plugin-share-linker-copy-button");
    setToolbarButtonLabel(copyButton, t("copy"), t("copyTitle"));

    const createButton = new ButtonComponent(containerEl)
      .setIcon("link")
      .setCta()
      .onClick(async () => {
        await this.runShareAction(kind, "symlink");
      });
    createButton.buttonEl.addClass("plugin-share-linker-create-button");
    setToolbarButtonLabel(createButton, t("symlink"), t("symlinkTitle"));
  }

  async refreshAll() {
    const t = this.plugin.t.bind(this.plugin);
    this.actionResults = { plugins: null, themes: null, snippets: null };
    this.configState = { pluginsEnabled: [], snippetsEnabled: [], themeSet: null };
    this.warnings = [];
    this.notes = [];
    this.themeActionSeen = false;

    try {
      this.plugins = await this.plugin.listPlugins();
      this.themes = await this.plugin.listThemes();
      this.snippets = await this.plugin.listSnippets();
    } catch (error) {
      this.plugins = [];
      this.themes = [];
      this.snippets = [];
      this.showError(t("listReadFailed", error.message));
    }

    this.renderPlugins();
    this.renderThemes();
    this.renderSnippets();
    this.renderResults();
  }

  async checkTargetPath() {
    if (this.busy) return;

    this.busy = true;
    this.plugin.beginDebugSession("check-target");
    const t = this.plugin.t.bind(this.plugin);
    const startedAt = Date.now();
    this.plugin.debug("check", `start target=${this.plugin.settings.targetVaultPath || "(empty)"}`);
    this.setStatusMessage(t("busyProgress", t("checkingTarget"), 0));
    const ticker = setInterval(() => {
      if (!this.busy) return;
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      this.setStatusMessage(t("busyProgress", t("checkingTarget"), seconds));
      this.plugin.debug("tick", `${seconds}s`);
    }, 1000);

    try {
      const info = await runWithTimeout(
        () => this.plugin.inspectTarget(this.plugin.settings.targetVaultPath),
        45000,
        t("actionTimeout", 45)
      );
      this.renderTargetCheck(info);
      this.plugin.debug("check", `rendered elapsed=${Date.now() - startedAt}ms`);
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      this.plugin.debug("check", `failed: ${message}`);
      this.showError(message);
      this.renderDebugTrail();
      new Notice(t("shareFailed", message));
    } finally {
      this.busy = false;
      clearInterval(ticker);
    }
  }

  renderTargetCheck(info) {
    if (!this.resultsEl) return;

    const t = this.plugin.t.bind(this.plugin);
    this.resultsEl.empty();
    const cardEl = this.resultsEl.createDiv("plugin-share-linker-result-card");
    cardEl.createDiv("plugin-share-linker-result-title").setText(t("checkTarget"));
    const linesEl = cardEl.createDiv("plugin-share-linker-result-lines");

    linesEl.createDiv("plugin-share-linker-config-line").setText(info.target.targetPath);
    const line = (label, ok) =>
      linesEl
        .createDiv("plugin-share-linker-result-line")
        .setText(t("targetCheckLine", label, ok ? t("yes") : t("no")));
    line(t("targetCheckExists"), true);
    line(t("targetCheckVault"), info.target.isVault);
    line(t("targetCheckWritable"), info.writable);
    linesEl.createDiv("plugin-share-linker-config-line").setText(t("targetCheckElapsed", info.elapsedMs));
    linesEl.createDiv("plugin-share-linker-restart-hint").setText(t("targetCheckHint"));
  }

  renderPlugins() {
    if (!this.pluginsListEl || !this.pluginsCountEl) return;

    const t = this.plugin.t.bind(this.plugin);
    const selected = new Set(this.plugin.settings.selectedPluginIds);
    const enabled = new Set(this.plugin.settings.enabledPluginIds);
    const pageSize = normalizePageSize(this.plugin.settings.pageSize);
    const totalPages = Math.max(1, Math.ceil(this.plugins.length / pageSize));
    this.currentPage = clamp(this.currentPage, 1, totalPages);
    const startIndex = (this.currentPage - 1) * pageSize;
    const pagePlugins = this.plugins.slice(startIndex, startIndex + pageSize);

    this.pluginsCountEl.setText(
      t("pluginsCount", this.plugins.length, selected.size, this.currentPage, totalPages)
    );
    this.pluginsListEl.empty();
    this.renderPagination(totalPages, pageSize);

    if (this.plugins.length === 0) {
      this.pluginsListEl.createDiv("plugin-share-linker-empty").setText(t("emptyPlugins"));
      return;
    }

    for (const plugin of pagePlugins) {
      this.renderPluginRow(plugin, selected, enabled);
    }
  }

  renderPluginRow(plugin, selected, enabled) {
    const t = this.plugin.t.bind(this.plugin);
    const rowEl = this.pluginsListEl.createDiv("plugin-share-linker-row");
    const checksEl = rowEl.createDiv("plugin-share-linker-checks");

    const shareLabel = checksEl.createEl("label", { cls: "plugin-share-linker-check" });
    const shareBox = shareLabel.createEl("input", { type: "checkbox" });
    shareLabel.createSpan({ text: t("share") });

    const enableLabel = checksEl.createEl("label", { cls: "plugin-share-linker-check" });
    const enableBox = enableLabel.createEl("input", { type: "checkbox" });
    enableLabel.createSpan({ text: t("enable") });

    shareBox.checked = selected.has(plugin.id);
    enableBox.checked = enabled.has(plugin.id);
    enableBox.disabled = !shareBox.checked;

    shareBox.addEventListener("change", async () => {
      const nextSelected = new Set(this.plugin.settings.selectedPluginIds);
      const nextEnabled = new Set(this.plugin.settings.enabledPluginIds);
      if (shareBox.checked) {
        nextSelected.add(plugin.id);
        nextEnabled.add(plugin.id);
      } else {
        nextSelected.delete(plugin.id);
        nextEnabled.delete(plugin.id);
      }
      this.plugin.settings.selectedPluginIds = Array.from(nextSelected);
      this.plugin.settings.enabledPluginIds = Array.from(nextEnabled);
      await this.plugin.saveSettings();
      this.renderPlugins();
    });

    enableBox.addEventListener("change", async () => {
      const nextEnabled = new Set(this.plugin.settings.enabledPluginIds);
      if (enableBox.checked) {
        nextEnabled.add(plugin.id);
      } else {
        nextEnabled.delete(plugin.id);
      }
      this.plugin.settings.enabledPluginIds = Array.from(nextEnabled);
      await this.plugin.saveSettings();
      this.renderPlugins();
    });

    const contentEl = rowEl.createDiv("plugin-share-linker-row-content");
    const titleEl = contentEl.createDiv("plugin-share-linker-row-title");
    titleEl.createSpan({ text: plugin.name });
    titleEl.createEl("code", { text: plugin.folderName });

    const metaText = plugin.version ? `v${plugin.version}` : t("noVersion");
    contentEl.createDiv("plugin-share-linker-row-meta").setText(metaText);

    if (plugin.description) {
      contentEl.createDiv("plugin-share-linker-row-desc").setText(plugin.description);
    }
  }

  renderPagination(totalPages, pageSize) {
    if (!this.pluginsPaginationEl) return;
    this.pluginsPaginationEl.empty();

    const t = this.plugin.t.bind(this.plugin);
    const previousButton = new ButtonComponent(this.pluginsPaginationEl)
      .setIcon("chevron-left")
      .onClick(() => {
        if (this.currentPage <= 1) return;
        this.currentPage -= 1;
        this.renderPlugins();
      });
    setToolbarButtonLabel(previousButton, t("previousPage"), t("previousPage"));
    previousButton.setDisabled(this.currentPage <= 1);

    const pageInfoEl = this.pluginsPaginationEl.createDiv("plugin-share-linker-page-info");
    pageInfoEl.setText(t("pageInfo", this.currentPage, totalPages));

    const nextButton = new ButtonComponent(this.pluginsPaginationEl)
      .setIcon("chevron-right")
      .onClick(() => {
        if (this.currentPage >= totalPages) return;
        this.currentPage += 1;
        this.renderPlugins();
      });
    setToolbarButtonLabel(nextButton, t("nextPage"), t("nextPage"));
    nextButton.setDisabled(this.currentPage >= totalPages);

    const sizeWrapperEl = this.pluginsPaginationEl.createDiv("plugin-share-linker-page-size");
    sizeWrapperEl.createSpan({ text: t("pageSizePrefix") });
    const selectEl = sizeWrapperEl.createEl("select");
    for (const size of PAGE_SIZES) {
      const optionEl = selectEl.createEl("option", { text: `${size}`, value: `${size}` });
      optionEl.selected = size === pageSize;
    }
    selectEl.addEventListener("change", async () => {
      this.plugin.settings.pageSize = normalizePageSize(Number(selectEl.value));
      this.currentPage = 1;
      await this.plugin.saveSettings();
      this.renderPlugins();
    });
    const suffix = t("pageSizeSuffix");
    if (suffix) sizeWrapperEl.createSpan({ text: suffix });
  }

  renderThemes() {
    if (!this.themesListEl || !this.themesCountEl) return;

    const t = this.plugin.t.bind(this.plugin);
    let selected = new Set(this.plugin.settings.selectedThemeNames);

    if (this.plugin.settings.targetThemeName && !selected.has(this.plugin.settings.targetThemeName)) {
      this.plugin.settings.targetThemeName = "";
      this.plugin.saveSettings();
    }

    this.themesCountEl.setText(t("themesCount", this.themes.length, selected.size));
    this.themesListEl.empty();

    if (this.themes.length === 0) {
      this.themesListEl.createDiv("plugin-share-linker-empty").setText(t("emptyThemes"));
    } else {
      for (const theme of this.themes) {
        const rowEl = this.themesListEl.createDiv("plugin-share-linker-row");
        const checkLabel = rowEl.createEl("label", { cls: "plugin-share-linker-check" });
        const checkBox = checkLabel.createEl("input", { type: "checkbox" });
        checkLabel.createSpan({ text: t("share") });
        checkBox.checked = selected.has(theme.folderName);
        checkBox.addEventListener("change", async () => {
          const nextSelected = new Set(this.plugin.settings.selectedThemeNames);
          if (checkBox.checked) {
            nextSelected.add(theme.folderName);
          } else {
            nextSelected.delete(theme.folderName);
            if (this.plugin.settings.targetThemeName === theme.folderName) {
              this.plugin.settings.targetThemeName = "";
            }
          }
          this.plugin.settings.selectedThemeNames = Array.from(nextSelected);
          await this.plugin.saveSettings();
          this.renderThemes();
        });

        const contentEl = rowEl.createDiv("plugin-share-linker-row-content");
        const titleEl = contentEl.createDiv("plugin-share-linker-row-title");
        titleEl.createSpan({ text: theme.name });
        const metaText = theme.version ? `v${theme.version}` : t("noVersion");
        contentEl.createDiv("plugin-share-linker-row-meta").setText(metaText);
      }
    }

    this.renderThemeRadio();
  }

  renderThemeRadio() {
    if (!this.themesRadioEl) return;

    const t = this.plugin.t.bind(this.plugin);
    this.themesRadioEl.empty();
    this.themesRadioEl.createDiv("plugin-share-linker-radio-title").setText(t("themeRadioTitle"));

    const optionsEl = this.themesRadioEl.createDiv("plugin-share-linker-radio-options");
    const selectedThemes = this.themes.filter((theme) =>
      this.plugin.settings.selectedThemeNames.includes(theme.folderName)
    );

    if (selectedThemes.length === 0) {
      optionsEl.createSpan({ cls: "plugin-share-linker-radio-empty", text: t("emptyThemeRadio") });
      return;
    }

    const addOption = (value, label) => {
      const labelEl = optionsEl.createEl("label", { cls: "plugin-share-linker-radio-option" });
      const inputEl = labelEl.createEl("input", {
        type: "radio",
        attr: { name: "plugin-share-linker-target-theme", value },
      });
      inputEl.checked = this.plugin.settings.targetThemeName === value;
      inputEl.addEventListener("change", async () => {
        this.plugin.settings.targetThemeName = value;
        await this.plugin.saveSettings();
        this.renderThemeRadio();
      });
      labelEl.createSpan({ text: label });
    };

    addOption("", t("themeRadioNone"));
    for (const theme of selectedThemes) {
      addOption(theme.folderName, theme.name);
    }
  }

  renderSnippets() {
    if (!this.snippetsListEl || !this.snippetsCountEl) return;

    const t = this.plugin.t.bind(this.plugin);
    const selected = new Set(this.plugin.settings.selectedSnippetNames);
    const enabled = new Set(this.plugin.settings.enabledSnippetNames);

    this.snippetsCountEl.setText(t("snippetsCount", this.snippets.length, selected.size));
    this.snippetsListEl.empty();

    if (this.snippets.length === 0) {
      this.snippetsListEl.createDiv("plugin-share-linker-empty").setText(t("emptySnippets"));
      return;
    }

    for (const snippet of this.snippets) {
      const rowEl = this.snippetsListEl.createDiv("plugin-share-linker-row");
      const checksEl = rowEl.createDiv("plugin-share-linker-checks");

      const shareLabel = checksEl.createEl("label", { cls: "plugin-share-linker-check" });
      const shareBox = shareLabel.createEl("input", { type: "checkbox" });
      shareLabel.createSpan({ text: t("share") });

      const enableLabel = checksEl.createEl("label", { cls: "plugin-share-linker-check" });
      const enableBox = enableLabel.createEl("input", { type: "checkbox" });
      enableLabel.createSpan({ text: t("enable") });

      shareBox.checked = selected.has(snippet.name);
      enableBox.checked = enabled.has(snippet.name);
      enableBox.disabled = !shareBox.checked;

      shareBox.addEventListener("change", async () => {
        const nextSelected = new Set(this.plugin.settings.selectedSnippetNames);
        const nextEnabled = new Set(this.plugin.settings.enabledSnippetNames);
        if (shareBox.checked) {
          nextSelected.add(snippet.name);
          nextEnabled.add(snippet.name);
        } else {
          nextSelected.delete(snippet.name);
          nextEnabled.delete(snippet.name);
        }
        this.plugin.settings.selectedSnippetNames = Array.from(nextSelected);
        this.plugin.settings.enabledSnippetNames = Array.from(nextEnabled);
        await this.plugin.saveSettings();
        this.renderSnippets();
      });

      enableBox.addEventListener("change", async () => {
        const nextEnabled = new Set(this.plugin.settings.enabledSnippetNames);
        if (enableBox.checked) {
          nextEnabled.add(snippet.name);
        } else {
          nextEnabled.delete(snippet.name);
        }
        this.plugin.settings.enabledSnippetNames = Array.from(nextEnabled);
        await this.plugin.saveSettings();
        this.renderSnippets();
      });

      const contentEl = rowEl.createDiv("plugin-share-linker-row-content");
      const titleEl = contentEl.createDiv("plugin-share-linker-row-title");
      titleEl.createEl("code", { text: snippet.fileName });
    }
  }

  async runShareAction(kind, mode) {
    if (this.busy) return;

    this.busy = true;
    this.plugin.beginDebugSession(`action ${kind}/${mode}`);
    const t = this.plugin.t.bind(this.plugin);
    const targetVaultPath = this.plugin.settings.targetVaultPath;
    this.plugin.debug("action", `start ${kind}/${mode} target=${targetVaultPath || "(empty)"}`);
    const isCopyMode = mode === "copy";
    const targetLabel = targetVaultPath ? ` → ${targetVaultPath}` : "";
    const busyLabel = `${isCopyMode ? t("copying") : t("linking")} [${this.kindLabel(kind)}${targetLabel}]`;
    const startedAt = Date.now();

    this.setStatusMessage(t("busyProgress", busyLabel, 0));
    const ticker = setInterval(() => {
      if (!this.busy) return;
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      this.setStatusMessage(t("busyProgress", busyLabel, seconds));
      this.plugin.debug("tick", `${seconds}s`);
    }, 1000);

    try {
      const outcome = await runWithTimeout(
        () => this.dispatchShare(kind, mode, targetVaultPath),
        ACTION_TIMEOUT_MS,
        t("actionTimeout", Math.round(ACTION_TIMEOUT_MS / 1000))
      );

      this.recordOutcome(kind, mode, outcome);
      this.renderResults();

      const createdCount = outcome.results.filter((result) => result.status === "created").length;
      new Notice(isCopyMode ? t("copyNotice", createdCount) : t("linkNotice", createdCount));
      this.plugin.debug("action", `done ${kind}/${mode} created=${createdCount}`);
      logDebug("action done", kind, mode, outcome.results.map((result) => result.status).join(","));
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      this.plugin.debug("action", `failed ${kind}/${mode}: ${message}`);
      logDebug("action failed", kind, mode, message, error && error.stack);
      this.showError(message);
      this.renderDebugTrail();
      new Notice(t("shareFailed", message));
    } finally {
      this.busy = false;
      clearInterval(ticker);
    }
  }

  dispatchShare(kind, mode, targetVaultPath) {
    if (kind === "plugins") {
      return this.plugin.sharePlugins(this.plugin.settings.selectedPluginIds, targetVaultPath, mode);
    }
    if (kind === "themes") {
      return this.plugin.shareThemes(this.plugin.settings.selectedThemeNames, targetVaultPath, mode);
    }
    return this.plugin.shareSnippets(this.plugin.settings.selectedSnippetNames, targetVaultPath, mode);
  }

  kindLabel(kind) {
    if (kind === "plugins") return this.plugin.t("sectionPlugins");
    if (kind === "themes") return this.plugin.t("sectionThemes");
    return this.plugin.t("sectionSnippets");
  }

  recordOutcome(kind, mode, outcome) {
    this.actionResults[kind] = { mode, results: outcome.results };

    if (outcome.target && !outcome.target.isVault) {
      this.warnings.push(this.plugin.t("targetCreatedVault"));
    }

    if (outcome.config) {
      const config = outcome.config;
      this.configState.pluginsEnabled = [...new Set([...this.configState.pluginsEnabled, ...config.pluginsEnabled])];
      this.configState.snippetsEnabled = [
        ...new Set([...this.configState.snippetsEnabled, ...config.snippetsEnabled]),
      ];
      if (config.themeSet) this.configState.themeSet = config.themeSet;
      this.warnings.push(...config.warnings);
      this.notes.push(...config.backups.map((backupPath) => this.plugin.t("backupMade", backupPath)));
    }

    if (kind === "themes") this.themeActionSeen = true;
    this.warnings = [...new Set(this.warnings)];
  }

  renderResults() {
    if (!this.resultsEl) return;

    const t = this.plugin.t.bind(this.plugin);
    this.resultsEl.empty();

    const kinds = [
      { key: "plugins", label: t("resultsPlugins") },
      { key: "themes", label: t("resultsThemes") },
      { key: "snippets", label: t("resultsSnippets") },
    ];
    const present = kinds.filter((kind) => this.actionResults[kind.key]);
    const hasConfig =
      this.configState.pluginsEnabled.length > 0 ||
      this.configState.snippetsEnabled.length > 0 ||
      !!this.configState.themeSet ||
      this.themeActionSeen;

    if (present.length === 0 && !hasConfig && this.warnings.length === 0) return;

    const cardEl = this.resultsEl.createDiv("plugin-share-linker-result-card");
    cardEl.createDiv("plugin-share-linker-result-title").setText(t("resultsTitle"));
    const linesEl = cardEl.createDiv("plugin-share-linker-result-lines");

    for (const kind of present) {
      const data = this.actionResults[kind.key];
      const summary = summarizeResults(data.results);
      const line =
        data.mode === "copy"
          ? t("copySummary", summary.created, summary.exists, summary.conflict, summary.error)
          : t("linkSummary", summary.created, summary.linked, summary.exists, summary.conflict, summary.error);
      linesEl.createDiv("plugin-share-linker-result-line").setText(`${kind.label}：${line}`);
    }

    if (this.configState.pluginsEnabled.length > 0 || this.configState.snippetsEnabled.length > 0) {
      linesEl
        .createDiv("plugin-share-linker-config-line")
        .setText(t("configEnableLine", this.configState.pluginsEnabled.length, this.configState.snippetsEnabled.length));
    }

    if (this.configState.themeSet) {
      linesEl.createDiv("plugin-share-linker-config-line").setText(t("configThemeLine", this.configState.themeSet));
    } else if (this.themeActionSeen) {
      linesEl.createDiv("plugin-share-linker-config-line").setText(t("configThemeUnchanged"));
    }

    if (present.length > 0) {
      linesEl.createDiv("plugin-share-linker-restart-hint").setText(t("restartHint"));
    }

    for (const warning of this.warnings) {
      cardEl.createDiv("plugin-share-linker-warning").setText(warning);
    }

    for (const note of this.notes) {
      cardEl.createDiv("plugin-share-linker-config-line").setText(note);
    }

    for (const kind of present) {
      const data = this.actionResults[kind.key];
      const detailEl = cardEl.createDiv("plugin-share-linker-result-detail");
      detailEl.createDiv("plugin-share-linker-subheading").setText(kind.label);
      const listEl = detailEl.createEl("ul", { cls: "plugin-share-linker-result-list" });
      for (const result of data.results) {
        const itemEl = listEl.createEl("li", {
          cls: `plugin-share-linker-result plugin-share-linker-result-${result.status}`,
        });
        itemEl.createSpan({
          text: t("resultLine", result.entry.name, t(`status.${result.status}`)),
        });
        if (result.message) itemEl.createDiv("plugin-share-linker-result-message").setText(result.message);
      }
    }
  }

  setStatusMessage(message) {
    if (!this.resultsEl) return;
    this.resultsEl.empty();
    const resultEl = this.resultsEl.createDiv("plugin-share-linker-message");
    resultEl.setText(message);
    resultEl.addClass("plugin-share-linker-message-busy");
  }

  showError(message) {
    if (!this.resultsEl) return;
    this.resultsEl.empty();
    this.resultsEl.createDiv("plugin-share-linker-message plugin-share-linker-message-error").setText(message);
  }

  renderDebugTrail() {
    const trail = (this.plugin.debugTrail || []).slice(-24);
    if (!this.resultsEl || trail.length === 0) return;

    const t = this.plugin.t.bind(this.plugin);
    const boxEl = this.resultsEl.createDiv("plugin-share-linker-debug");
    boxEl.createDiv("plugin-share-linker-debug-title").setText(t("debugTrailTitle"));
    boxEl.createDiv("plugin-share-linker-debug-line").setText(t("debugLogPath", this.plugin.getDebugLogPath() || "-"));
    const startAt = this.plugin.actionStartedAt || trail[0].at;
    for (const entry of trail) {
      const offset = Math.max(0, entry.at - startAt);
      boxEl.createDiv("plugin-share-linker-debug-line").setText(`+${offset}ms  ${entry.label}: ${entry.detail}`);
    }
  }
}

async function shareEntry(entry, targetPath, mode, symlinkType, t, debug) {
  const log = typeof debug === "function" ? debug : logDebug;
  log("entry", `start ${entry.name} → ${targetPath}`);
  const existing = await fs.promises.lstat(targetPath).catch(() => null);
  const existedBefore = !!existing;
  log(
    "entry",
    `lstat done ${entry.name} existing=${existing ? (existing.isSymbolicLink() ? "symlink" : "file/dir") : "none"}`
  );
  try {

    if (existing) {
      if (existing.isSymbolicLink()) {
        const linkTarget = await fs.promises.readlink(targetPath);
        const absoluteLinkTarget = path.resolve(path.dirname(targetPath), linkTarget);
        if (path.resolve(absoluteLinkTarget) === path.resolve(entry.sourcePath)) {
          return { entry, status: "linked", message: t("alreadyLinked"), targetPath };
        }
        return { entry, status: "conflict", message: t("linkConflict", linkTarget), targetPath };
      }

      return {
        entry,
        status: "exists",
        message: mode === "copy" ? t("copyExistsSkipped") : t("existsSkipped"),
        targetPath,
      };
    }

    if (mode === "copy") {
      log("entry", `copy start ${entry.name}`);
      if (symlinkType === "dir") {
        await fs.promises.cp(entry.sourcePath, targetPath, {
          recursive: true,
          errorOnExist: true,
          force: false,
        });
      } else {
        await fs.promises.copyFile(entry.sourcePath, targetPath);
      }
      log("entry", `copy done ${entry.name}`);
    } else {
      log("entry", `symlink start ${entry.name}`);
      await runWithTimeout(
        () => fs.promises.symlink(entry.sourcePath, targetPath, symlinkType),
        SYMLINK_TIMEOUT_MS,
        t("symlinkTimeout", Math.round(SYMLINK_TIMEOUT_MS / 1000), entry.name)
      );
      log("entry", `symlink done ${entry.name}`);
    }

    return { entry, status: "created", message: targetPath, targetPath };
  } catch (error) {
    if (mode === "copy" && !existedBefore) {
      // 复制中断会留下半个目录，清掉它，避免下次被当成“已存在”而跳过。
      try {
        await fs.promises.rm(targetPath, { recursive: true, force: true });
      } catch (cleanupError) {
        logDebug("copy cleanup failed", targetPath, cleanupError && cleanupError.message);
      }
    }
    logDebug("share entry failed", entry && entry.name, error && error.message);
    log("entry", `failed ${entry.name}: ${error && error.message}`);
    return { entry, status: "error", message: error.message, targetPath };
  }
}

async function writeCommunityPlugins(configDir, pluginIds, t, debug) {
  const log = typeof debug === "function" ? debug : logDebug;
  const filePath = path.join(configDir, "community-plugins.json");
  log("config", `community read start ${filePath}`);
  const { existed, value, parseError } = await readJsonFile(filePath, []);
  const current = Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
  const currentSet = new Set(current);
  const added = [];

  for (const id of pluginIds) {
    if (currentSet.has(id)) continue;
    currentSet.add(id);
    added.push(id);
  }

  const result = { added, filePath, backupPath: null, warnings: [] };
  if (parseError) result.warnings.push(t("configParseWarning", filePath));
  log("config", `community read done existing=${existed} current=${current.length} added=${added.length}`);
  if (added.length === 0) return result;

  await fs.promises.mkdir(configDir, { recursive: true });
  if (existed) {
    log("config", "community backup start");
    result.backupPath = await backupFile(filePath);
    log("config", `community backup done ${result.backupPath}`);
  }
  log("config", "community write start");
  await writeJsonFile(filePath, [...current, ...added]);
  log("config", "community write done");

  return result;
}

async function writeAppearanceConfig(configDir, options, t, debug) {
  const log = typeof debug === "function" ? debug : logDebug;
  const filePath = path.join(configDir, "appearance.json");
  log("config", `appearance read start ${filePath}`);
  const { existed, value, parseError } = await readJsonFile(filePath, {});
  const appearance = isPlainObject(value) ? Object.assign({}, value) : {};

  const result = { snippetsAdded: [], themeSet: null, filePath, backupPath: null, warnings: [] };
  if (parseError) result.warnings.push(t("configParseWarning", filePath));

  if (Array.isArray(options.snippetNames) && options.snippetNames.length > 0) {
    const current = Array.isArray(appearance.enabledCssSnippets)
      ? appearance.enabledCssSnippets.filter((name) => typeof name === "string")
      : [];
    const currentSet = new Set(current);
    const added = [];
    for (const name of options.snippetNames) {
      if (currentSet.has(name)) continue;
      currentSet.add(name);
      added.push(name);
    }
    if (added.length > 0) {
      appearance.enabledCssSnippets = [...current, ...added];
      result.snippetsAdded = added;
    }
  }

  if (options.themeName) {
    appearance.cssTheme = options.themeName;
    result.themeSet = options.themeName;
  }

  log("config", `appearance read done existing=${existed} snippets=${result.snippetsAdded.length} theme=${result.themeSet}`);
  if (result.snippetsAdded.length === 0 && !result.themeSet) return result;

  await fs.promises.mkdir(configDir, { recursive: true });
  if (existed) {
    log("config", "appearance backup start");
    result.backupPath = await backupFile(filePath);
    log("config", `appearance backup done ${result.backupPath}`);
  }
  log("config", "appearance write start");
  await writeJsonFile(filePath, appearance);
  log("config", "appearance write done");

  return result;
}

async function readJsonFile(filePath, fallback) {
  const result = { existed: false, value: fallback, parseError: null };
  let raw;

  try {
    raw = await fs.promises.readFile(filePath, "utf8");
    result.existed = true;
  } catch (error) {
    if (error.code === "ENOENT") return result;
    throw error;
  }

  try {
    result.value = JSON.parse(raw);
  } catch (error) {
    result.parseError = error.message;
    result.value = fallback;
  }

  return result;
}

async function backupFile(filePath) {
  const backupPath = `${filePath}.bak`;
  try {
    await fs.promises.copyFile(filePath, backupPath);
    return backupPath;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeJsonFile(filePath, value) {
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.promises.writeFile(tmpPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    await fs.promises.rename(tmpPath, filePath);
  } finally {
    await fs.promises.unlink(tmpPath).catch(() => {});
  }
}

async function readDirSafe(dirPath) {
  try {
    return await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function isFile(filePath) {
  const stats = await fs.promises.stat(filePath).catch(() => null);
  return !!stats && stats.isFile();
}

function runWithTimeout(task, timeoutMs, timeoutMessage) {
  let timer = null;
  const timeoutPromise = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  return Promise.race([Promise.resolve().then(task), timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function logDebug(...args) {
  try {
    if (typeof console !== "undefined" && typeof console.debug === "function") {
      console.debug("[share-linker]", ...args);
    }
  } catch (error) {
    // logging must never break sharing
  }
}

function isLanded(status) {
  return status === "created" || status === "linked" || status === "exists";
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function summarizeResults(results) {
  const summary = { created: 0, linked: 0, exists: 0, conflict: 0, error: 0 };
  for (const result of results) {
    if (summary[result.status] !== undefined) summary[result.status] += 1;
  }
  return summary;
}

function compareByName(a, b) {
  return a.name.localeCompare(b.name, "zh-Hans-CN");
}

function createSection(containerEl, title) {
  const sectionEl = containerEl.createDiv("plugin-share-linker-section");
  sectionEl.createEl("h3", { text: title });
  const bodyEl = sectionEl.createDiv("plugin-share-linker-section-body");
  return { sectionEl, bodyEl };
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string");
}

function normalizePathInput(value) {
  return (value || "").trim().replace(/^~(?=$|\/|\\)/, process.env.HOME || process.env.USERPROFILE || "~");
}

function normalizePageSize(value) {
  return PAGE_SIZES.includes(value) ? value : 10;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function setToolbarButtonLabel(button, label, title) {
  button.buttonEl.addClass("plugin-share-linker-toolbar-button");
  button.buttonEl.title = title;
  button.buttonEl.setAttribute("aria-label", label);
  button.buttonEl.createSpan({
    text: label,
    cls: "plugin-share-linker-button-label",
  });
}
