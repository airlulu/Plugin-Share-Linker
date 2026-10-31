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

  check("display() renders plugin rows", countByClass(tab.pluginsListEl, "plugin-share-linker-row") === 1);
  check("display() renders theme rows", countByClass(tab.themesListEl, "plugin-share-linker-row") === 1);
  check("display() renders snippet rows", countByClass(tab.snippetsListEl, "plugin-share-linker-row") === 1);
  check("three sections rendered", countByClass(tab.containerEl, "plugin-share-linker-section") === 3);
  check("plugins toolbar has 5 buttons", tab.pluginsToolbarEl.children.length === 5);
  check("themes toolbar has 2 buttons", tab.themesToolbarEl.children.length === 2);
  check("snippets toolbar has 2 buttons", tab.snippetsToolbarEl.children.length === 2);

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
  check("english render works", countByClass(tab.containerEl, "plugin-share-linker-section") === 3);
  check("english count line", tab.pluginsCountEl.textContent.includes("plugins found"), tab.pluginsCountEl.textContent);
  plugin.settings.language = "zh";

  // empty vault handling
  plugin.app.vault.adapter.getBasePath = () => EMPTY_VAULT;
  await tab.display();
  check("empty vault render works", countByClass(tab.containerEl, "plugin-share-linker-empty") === 3);

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

  console.log("\n" + (checks - failures) + "/" + checks + " checks passed");
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error("UI TEST CRASH", error);
  process.exit(2);
});
