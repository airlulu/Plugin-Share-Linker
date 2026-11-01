const fs = require("fs");
const path = require("path");
const os = require("os");

const WORK = path.join(os.tmpdir(), "plugin-share-linker-tests", "ui");
const VAULT_A = path.join(WORK, "vault-a");
const VAULT_B = path.join(WORK, "vault-b");
const EMPTY_VAULT = path.join(WORK, "empty-vault");
const MAIN_JS = path.join(__dirname, "..", "main.js");
const OBSIDIAN_STUB = path.join(__dirname, "obsidian-stub.js");

// ---- tiny DOM ------------------------------------------------------------
function createEl(tag) {
  const el = {
    tagName: String(tag || "div").toUpperCase(),
    children: [],
    classes: new Set(),
    textContent: "",
    title: "",
    attributes: {},
    listeners: {},
    value: "",
    checked: false,
    disabled: false,
    selected: false,
    style: {},
  };
  el.classList = {
    add: (cls) => el.classes.add(cls),
    remove: (cls) => el.classes.delete(cls),
    contains: (cls) => el.classes.has(cls),
  };
  el.addClass = (cls) => {
    if (cls) String(cls).split(/\s+/).filter(Boolean).forEach((c) => el.classes.add(c));
  };
  el.removeClass = (cls) => {
    el.classes.delete(cls);
  };
  el.setText = (text) => {
    el.textContent = text;
  };
  el.empty = () => {
    el.children = [];
    el.textContent = "";
  };
  el.setAttribute = (name, value) => {
    el.attributes[name] = value;
  };
  el.getAttribute = (name) => el.attributes[name];
  el.appendChild = (child) => {
    el.children.push(child);
    child.parent = el;
    return child;
  };
  el.createEl = (childTag, opts) => {
    const child = createEl(childTag);
    if (opts) {
      if (opts.cls) child.addClass(opts.cls);
      if (opts.text !== undefined) child.setText(opts.text);
      if (opts.type) child.type = opts.type;
      if (opts.value !== undefined) child.value = opts.value;
      if (opts.attr) {
        for (const key of Object.keys(opts.attr)) child.setAttribute(key, opts.attr[key]);
      }
    }
    return el.appendChild(child);
  };
  el.createDiv = (cls) => el.createEl("div", { cls });
  el.createSpan = (opts) => el.createEl("span", typeof opts === "string" ? { cls: opts } : opts);
  el.addEventListener = (type, handler) => {
    el.listeners[type] = el.listeners[type] || [];
    el.listeners[type].push(handler);
  };
  el.click = async () => {
    if (el.type === "checkbox") el.checked = !el.checked;
    for (const handler of el.listeners.change || []) await handler();
  };
  return el;
}

function walk(el, fn) {
  fn(el);
  for (const child of el.children || []) walk(child, fn);
}

function findByAria(root, label) {
  let found = null;
  walk(root, (el) => {
    if (!found && el.getAttribute && el.getAttribute("aria-label") === label) found = el;
  });
  return found;
}

function countByClass(root, cls) {
  let count = 0;
  walk(root, (el) => {
    if (el.classes && el.classes.has(cls)) count += 1;
  });
  return count;
}

function textOf(root) {
  let text = "";
  walk(root, (el) => {
    if (typeof el.textContent === "string" && el.textContent) text += el.textContent + "\n";
  });
  return text;
}

// ---- obsidian stubs ------------------------------------------------------
const obsidian = require(OBSIDIAN_STUB);

class ButtonComponent {
  constructor(containerEl) {
    this.buttonEl = createEl("button");
    if (containerEl && containerEl.appendChild) containerEl.appendChild(this.buttonEl);
  }
  setIcon() {
    return this;
  }
  setCta() {
    return this;
  }
  onClick(handler) {
    this.buttonEl.__onClick = handler;
    return this;
  }
  setDisabled(value) {
    this.buttonEl.disabled = value;
    return this;
  }
}

class Setting {
  constructor(containerEl) {
    this.settingEl = createEl("div");
    if (containerEl && containerEl.appendChild) containerEl.appendChild(this.settingEl);
  }
  setName(name) {
    this.name = name;
    return this;
  }
  setDesc(desc) {
    this.desc = desc;
    return this;
  }
  addText(callback) {
    const inputEl = createEl("input");
    const component = {
      inputEl,
      setPlaceholder(value) {
        this.placeholder = value;
        return this;
      },
      setValue(value) {
        this.value = value;
        inputEl.value = value;
        return this;
      },
      onChange(handler) {
        this.changeHandler = handler;
        return this;
      },
    };
    callback(component);
    this.text = component;
    return this;
  }
}

class PluginSettingTab {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = createEl("div");
  }
}

class Notice {
  constructor(message) {
    this.message = message;
    obsidian.lastNotice = message;
  }
}

obsidian.ButtonComponent = ButtonComponent;
obsidian.Setting = Setting;
obsidian.PluginSettingTab = PluginSettingTab;
obsidian.Notice = Notice;
obsidian.Plugin.prototype.addSettingTab = function (tab) {
  this.__tab = tab;
};

const Module = require("module");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === "obsidian") return OBSIDIAN_STUB;
  return originalResolveFilename.call(this, request, ...args);
};

// ---- fixtures ------------------------------------------------------------
let failures = 0;
let checks = 0;

function check(name, condition, extra) {
  checks += 1;
  if (condition) console.log("PASS " + name);
  else {
    failures += 1;
    console.log("FAIL " + name + (extra !== undefined ? " :: " + extra : ""));
  }
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function writeJson(filePath, value) {
  writeFile(filePath, JSON.stringify(value, null, 2) + "\n");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function setup() {
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(VAULT_A, { recursive: true });
  fs.mkdirSync(VAULT_B, { recursive: true });
  fs.mkdirSync(EMPTY_VAULT, { recursive: true });

  writeJson(path.join(VAULT_A, ".obsidian", "plugins", "dataview", "manifest.json"), {
    id: "dataview",
    name: "Dataview",
    version: "0.5.67",
    description: "Complex data views.",
  });
  writeFile(path.join(VAULT_A, ".obsidian", "themes", "Blue Topaz", "theme.css"), "/* theme */");
  writeJson(path.join(VAULT_A, ".obsidian", "themes", "Blue Topaz", "manifest.json"), {
    name: "Blue Topaz",
    version: "2023080203",
  });
  writeFile(path.join(VAULT_A, ".obsidian", "snippets", "wide-tables.css"), ".wide-table {}");

  writeJson(path.join(VAULT_B, ".obsidian", "community-plugins.json"), ["other-plugin"]);
  writeJson(path.join(VAULT_B, ".obsidian", "appearance.json"), { theme: "moonstone", cssTheme: "" });
}

async function main() {
  setup();

  const Ctor = require(MAIN_JS);
  const app = {
    vault: { adapter: { getBasePath: () => VAULT_A }, configDir: ".obsidian" },
    setting: null,
  };
  const plugin = new Ctor(app, { id: "plugin-share-linker", name: "Share Linker" });
  plugin.__data = { language: "zh" };
  await plugin.onload();

  const tab = plugin.__tab;
  check("settings tab created", !!tab);
  await tab.display();

  check("display() renders plugin rows", countByClass(tab.pluginsListEl, "plugin-share-linker-pair") === 1);
  check("display() renders theme rows", countByClass(tab.themesListEl, "plugin-share-linker-pair") === 1);
  check("display() renders snippet rows", countByClass(tab.snippetsListEl, "plugin-share-linker-pair") === 1);
  check("four sections rendered", countByClass(tab.containerEl, "plugin-share-linker-section") === 4);
  check("plugins toolbar has 5 buttons", tab.pluginsToolbarEl.children.length === 5);
  check("themes toolbar has 2 buttons", tab.themesToolbarEl.children.length === 2);
  check("snippets toolbar has 2 buttons", tab.snippetsToolbarEl.children.length === 2);
  check("pair column heads rendered", countByClass(tab.containerEl, "plugin-share-linker-pair-head") === 3);
  check("target state legend rendered", textOf(tab.containerEl).includes("目标库状态："));
  check(
    "rows start with the not-checked target state",
    countByClass(tab.pluginsListEl, "plugin-share-linker-target-unknown") === 1
  );

  // select all via button wiring
  plugin.settings.targetVaultPath = VAULT_B;
  const selectAllButton = findByAria(tab.pluginsToolbarEl, "全选");
  check("select all button found", !!selectAllButton);
  await selectAllButton.__onClick();
  check("select all selects plugins", JSON.stringify(plugin.settings.selectedPluginIds) === JSON.stringify(["dataview"]));
  check("select all enables plugins", JSON.stringify(plugin.settings.enabledPluginIds) === JSON.stringify(["dataview"]));

  // share through the real button
  const copyButton = findByAria(tab.pluginsToolbarEl, "复制");
  check("copy button found", !!copyButton);
  await copyButton.__onClick();
  check("plugin copied via UI", fs.existsSync(path.join(VAULT_B, ".obsidian", "plugins", "dataview", "manifest.json")));
  check(
    "plugin enabled via UI",
    JSON.stringify(readJson(path.join(VAULT_B, ".obsidian", "community-plugins.json"))) ===
      JSON.stringify(["other-plugin", "dataview"])
  );
  check("results card rendered", countByClass(tab.resultsEl, "plugin-share-linker-result-card") === 1);
  check("result detail rendered", countByClass(tab.resultsEl, "plugin-share-linker-result") >= 1);

  // theme + snippet selection through persisted settings, then share via buttons
  plugin.settings.selectedThemeNames = ["Blue Topaz"];
  plugin.settings.selectedSnippetNames = ["wide-tables"];
  plugin.settings.enabledSnippetNames = ["wide-tables"];
  tab.renderThemes();
  tab.renderSnippets();
  await findByAria(tab.themesToolbarEl, "复制").__onClick();
  check("theme copied via UI", fs.existsSync(path.join(VAULT_B, ".obsidian", "themes", "Blue Topaz", "theme.css")));
  check("theme auto-set via UI", readJson(path.join(VAULT_B, ".obsidian", "appearance.json")).cssTheme === "Blue Topaz");
  await findByAria(tab.snippetsToolbarEl, "复制").__onClick();
  const appearance = readJson(path.join(VAULT_B, ".obsidian", "appearance.json"));
  check("snippet copied via UI", fs.existsSync(path.join(VAULT_B, ".obsidian", "snippets", "wide-tables.css")));
  check(
    "snippet enabled via UI",
    JSON.stringify(appearance.enabledCssSnippets) === JSON.stringify(["wide-tables"])
  );

  // checkbox wiring: uncheck the plugin share box
  const checkboxes = [];
  walk(tab.pluginsListEl, (el) => {
    if (el.tagName === "INPUT" && el.type === "checkbox") checkboxes.push(el);
  });
  check("plugin row has two checkboxes", checkboxes.length === 2);
  await checkboxes[0].click();
  check("unchecking share clears selection", plugin.settings.selectedPluginIds.length === 0);
  check("unchecking share clears enable flag", plugin.settings.enabledPluginIds.length === 0);

  // language switch re-renders
  obsidian.Notice = obsidian.Notice;
  plugin.settings.language = "en";
  await tab.display();
  check("english render works", countByClass(tab.containerEl, "plugin-share-linker-section") === 4);
  check("english count line", tab.pluginsCountEl.textContent.includes("plugins found"), tab.pluginsCountEl.textContent);
  plugin.settings.language = "zh";

  // empty vault handling
  plugin.app.vault.adapter.getBasePath = () => EMPTY_VAULT;
  await tab.display();
  check("empty vault render works", countByClass(tab.containerEl, "plugin-share-linker-empty") === 4);

  // error path: invalid target
  plugin.app.vault.adapter.getBasePath = () => VAULT_A;
  plugin.settings.targetVaultPath = path.join(WORK, "does-not-exist");
  await tab.runShareAction("plugins", "copy");
  check("error message rendered", countByClass(tab.resultsEl, "plugin-share-linker-message-error") === 1);
  check("error notice shown", String(obsidian.lastNotice || "").length >= 0);
  const errorText = textOf(tab.resultsEl);
  check("debug trail rendered on error", errorText.includes("调试轨迹"), errorText);
  check("debug trail lists the target step", errorText.includes("target:"), errorText);

  // empty selection: must fail fast with a message, not stay busy
  const targetC = path.join(WORK, "target-c");
  fs.mkdirSync(path.join(targetC, ".obsidian"), { recursive: true });
  plugin.settings.targetVaultPath = targetC;
  plugin.settings.selectedSnippetNames = [];
  await tab.runShareAction("snippets", "symlink");
  check("empty selection shows error", countByClass(tab.resultsEl, "plugin-share-linker-message-error") === 1);
  check("busy flag cleared after error", tab.busy === false);
  check("empty selection notice", String(obsidian.lastNotice).includes("请至少选择一个 CSS 片段"), obsidian.lastNotice);

  // busy guard: a second click while busy is ignored
  tab.busy = true;
  plugin.settings.selectedPluginIds = ["dataview"];
  await tab.runShareAction("plugins", "copy");
  check("second click ignored while busy", tab.busy === true);
  tab.busy = false;

  // target path check button
  plugin.app.vault.adapter.getBasePath = () => VAULT_A;
  plugin.settings.targetVaultPath = VAULT_B;
  const checkButton = findByAria(tab.containerEl, "检查目标路径");
  check("target check button found", !!checkButton);
  await checkButton.__onClick();
  const checkText = textOf(tab.resultsEl);
  check("target check shows writable", checkText.includes("文件夹可写：是"), checkText);
  check("target check shows vault", checkText.includes("是 Obsidian 库（找到 .obsidian）：是"), checkText);
  check("target check reports elapsed time", /耗时：\d+ ms/.test(checkText), checkText);
  check(
    "target probe cleaned up",
    fs.readdirSync(VAULT_B).filter((name) => name.startsWith(".plugin-share-linker-probe-")).length === 0
  );

  // --- Target vault picker buttons ----------------------------------------
  check("choose button found", !!findByAria(tab.containerEl, "选择…"));
  check("browse button found", !!findByAria(tab.containerEl, "浏览…"));
  await tab.openVaultPicker();
  check("vault picker opens without throwing", true);

  // --- Link health section -------------------------------------------------
  const linkType = process.platform === "win32" ? "junction" : "dir";
  const goneDir = path.join(WORK, "gone-ui");
  fs.mkdirSync(goneDir, { recursive: true });
  let healthFixture = true;
  try {
    fs.rmSync(path.join(VAULT_B, ".obsidian", "plugins", "dataview"), { recursive: true, force: true });
    fs.symlinkSync(goneDir, path.join(VAULT_B, ".obsidian", "plugins", "dataview"), linkType);
    fs.symlinkSync(goneDir, path.join(VAULT_B, ".obsidian", "plugins", "gone-ui"), linkType);
    fs.rmSync(goneDir, { recursive: true, force: true });
  } catch (error) {
    healthFixture = false;
    console.log("SKIP link health assertions (" + error.code + ")");
  }

  const clickEl = async (element) => {
    for (const handler of (element && element.listeners && element.listeners.click) || []) {
      await handler();
    }
  };

  if (healthFixture) {
    plugin.app.vault.adapter.getBasePath = () => VAULT_A;
    plugin.settings.targetVaultPath = VAULT_B;
    await tab.refreshAll();
    await tab.checkTargetLinks();

    check("health inventory created", !!tab.targetInventory);
    check(
      "health badge shows broken count",
      String(tab.healthBadgeEl.textContent).includes("失效"),
      tab.healthBadgeEl.textContent
    );
    check("health rows rendered", countByClass(tab.healthResultEl, "plugin-share-linker-health-row") === 2);
    check("bulk rebuild button rendered", !!findByAria(tab.healthBulkEl, "全部重建"));
    check("bulk delete button rendered", !!findByAria(tab.healthBulkEl, "全部删除"));
    check(
      "paired rows re-render with target state",
      countByClass(tab.pluginsListEl, "plugin-share-linker-pair") >= 2
    );
    check(
      "broken target chips rendered in rows",
      countByClass(tab.pluginsListEl, "plugin-share-linker-target-broken") >= 1
    );
    check("target-only placeholder rendered", textOf(tab.pluginsListEl).includes("当前库无同名项"));

    const rebuildButton = findByAria(tab.healthResultEl, "重建链接");
    check("rebuild button found", !!rebuildButton);
    await clickEl(rebuildButton);
    const rebuiltTarget = fs.readlinkSync(path.join(VAULT_B, ".obsidian", "plugins", "dataview"));
    check(
      "rebuild button rewrites the link to the current vault",
      path.resolve(rebuiltTarget) === path.resolve(VAULT_A, ".obsidian", "plugins", "dataview"),
      rebuiltTarget
    );
    check("health rows drop after rebuild", countByClass(tab.healthResultEl, "plugin-share-linker-health-row") === 1);

    const deleteButton = findByAria(tab.healthResultEl, "删除链接");
    check("delete button found", !!deleteButton);
    await clickEl(deleteButton);
    let goneLinkStillThere = true;
    try {
      fs.lstatSync(path.join(VAULT_B, ".obsidian", "plugins", "gone-ui"));
    } catch (error) {
      goneLinkStillThere = false;
    }
    check("delete button removes the broken link", !goneLinkStillThere);
    check("health empty state after cleanup", countByClass(tab.healthResultEl, "plugin-share-linker-health-row") === 0);
    check(
      "health badge switches to the clear state",
      String(tab.healthBadgeEl.textContent).includes("未发现"),
      tab.healthBadgeEl.textContent
    );
  }

  if (healthFixture) {
    // --- Bulk delete on a fresh pair of broken links ----------------------
    const goneDir2 = path.join(WORK, "gone-ui-2");
    fs.mkdirSync(goneDir2, { recursive: true });
    fs.symlinkSync(goneDir2, path.join(VAULT_B, ".obsidian", "plugins", "gone-a"), linkType);
    fs.symlinkSync(goneDir2, path.join(VAULT_B, ".obsidian", "plugins", "gone-b"), linkType);
    fs.rmSync(goneDir2, { recursive: true, force: true });

    await tab.checkTargetLinks();
    const deletableEntries = tab.targetInventory.kinds.plugins.filter(
      (entry) => entry.status === "broken" && !tab.hasSameNameSource("plugins", entry.name)
    );
    check("bulk delete gathers the no-source links", deletableEntries.length === 2, JSON.stringify(deletableEntries.map((entry) => entry.name)));
    await tab.runBulkDelete(deletableEntries);
    check("bulk delete notice", String(obsidian.lastNotice).includes("全部删除完成"), obsidian.lastNotice);
    check("bulk delete cleared the health rows", countByClass(tab.healthResultEl, "plugin-share-linker-health-row") === 0);
  }

  // --- Picker / confirm modals ---------------------------------------------
  const T = Ctor.__test;
  const pickerPicks = [];
  const picker = new T.TargetVaultPickerModal(app, {
    title: "选择目标 Vault",
    subtitle: "来自 Obsidian 已记录的库",
    emptyText: "没有可选的库。",
    browseLabel: "浏览…",
    browseTitle: "用系统文件夹对话框选择目标 Vault",
    cancelLabel: "取消",
    currentChip: "当前",
    openChip: "打开中",
    missingChip: "目录不存在",
    currentVaultChip: "当前库，不可选",
    vaults: [
      { path: "E:\\known-saved", exists: true, isSaved: true, isOpen: true, isCurrent: false, lastOpenedAt: 3 },
      { path: "E:\\vault-open", exists: true, isSaved: false, isOpen: true, isCurrent: false, lastOpenedAt: 2 },
      { path: "E:\\vault-missing", exists: false, isSaved: false, isOpen: false, isCurrent: false, lastOpenedAt: 1 },
      { path: "E:\\vault-current", exists: true, isSaved: false, isOpen: false, isCurrent: true, lastOpenedAt: 0 },
    ],
    onPick: (picked) => pickerPicks.push(picked),
    onBrowse: () => pickerPicks.push("browse"),
  });
  picker.open();
  const pickerText = textOf(picker.contentEl);
  check("picker lists vault paths", pickerText.includes("E:\\known-saved") && pickerText.includes("E:\\vault-open"), pickerText);
  check(
    "picker marks saved/open/missing/current",
    ["当前", "打开中", "目录不存在", "当前库，不可选"].every((label) => pickerText.includes(label)),
    pickerText
  );
  const vaultRows = [];
  walk(picker.contentEl, (el) => {
    if (el.classes && el.classes.has("plugin-share-linker-vault-row")) vaultRows.push(el);
  });
  check("picker renders one row per vault", vaultRows.length === 4);
  check("picker disables the missing vault row", vaultRows[2].classes.has("is-disabled"));
  check("picker disables the current-vault row", vaultRows[3].classes.has("is-disabled"));
  await vaultRows[0].listeners.click[0]();
  check("picker picking a row reports the path", pickerPicks[0] === "E:\\known-saved", JSON.stringify(pickerPicks));

  let confirmed = 0;
  const confirmModal = new T.TargetActionConfirmModal(app, {
    title: "确认删除以下链接？",
    warning: "删除会移除链接本身。",
    lines: ["a → x", "b → y"],
    confirmLabel: "确认",
    cancelLabel: "取消",
    onConfirm: () => {
      confirmed += 1;
    },
  });
  confirmModal.open();
  const confirmText = textOf(confirmModal.contentEl);
  check("confirm modal lists the affected links", confirmText.includes("a → x") && confirmText.includes("b → y"), confirmText);
  check("confirm modal shows the warning", confirmText.includes("删除会移除链接本身。"), confirmText);
  const confirmButtons = [];
  walk(confirmModal.contentEl, (el) => {
    if (el.classes && el.classes.has("mod-cta")) confirmButtons.push(el);
  });
  await confirmButtons[0].listeners.click[0]();
  check("confirm modal invokes onConfirm", confirmed === 1);

  console.log("\n" + (checks - failures) + "/" + checks + " checks passed");
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error("UI TEST CRASH", error);
  process.exit(2);
});
