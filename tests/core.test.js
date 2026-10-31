const fs = require("fs");
const path = require("path");
const os = require("os");

const WORK = path.join(os.tmpdir(), "plugin-share-linker-tests", "core");
const VAULT_A = path.join(WORK, "vault-a");
const VAULT_B = path.join(WORK, "vault-b");
const VAULT_C = path.join(WORK, "vault-c");
const MAIN_JS = path.join(__dirname, "..", "main.js");

// Resolve the `obsidian` import to the local stub module.
const Module = require("module");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === "obsidian") return path.join(__dirname, "obsidian-stub.js");
  return originalResolveFilename.call(this, request, ...args);
};

let failures = 0;
let checks = 0;

function check(name, condition, extra) {
  checks += 1;
  if (condition) {
    console.log("PASS " + name);
  } else {
    failures += 1;
    console.log("FAIL " + name + (extra !== undefined ? " :: " + extra : ""));
  }
}

function eq(name, actual, expected) {
  check(
    name,
    JSON.stringify(actual) === JSON.stringify(expected),
    "actual=" + JSON.stringify(actual) + " expected=" + JSON.stringify(expected)
  );
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

function rmrf(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

async function expectThrows(name, fn, includes) {
  try {
    await fn();
    check(name, false, "did not throw");
  } catch (error) {
    check(name, error.message.includes(includes), "message=" + error.message);
  }
}

function setupVaults() {
  rmrf(WORK);
  fs.mkdirSync(VAULT_A, { recursive: true });
  fs.mkdirSync(VAULT_B, { recursive: true });
  fs.mkdirSync(VAULT_C, { recursive: true });

  // Current vault (A)
  writeJson(path.join(VAULT_A, ".obsidian", "plugins", "dataview", "manifest.json"), {
    id: "dataview",
    name: "Dataview",
    version: "0.5.67",
    description: "Complex data views for the data-obsessed.",
  });
  writeJson(path.join(VAULT_A, ".obsidian", "plugins", "dataview", "data.json"), { refreshInterval: 2500 });
  writeJson(path.join(VAULT_A, ".obsidian", "plugins", "templater-obsidian", "manifest.json"), {
    id: "templater-obsidian",
    name: "Templater",
    version: "2.4.1",
    description: "Create and use templates.",
  });
  writeFile(path.join(VAULT_A, ".obsidian", "plugins", "broken-plugin", "readme.txt"), "no manifest here");
  writeJson(path.join(VAULT_A, ".obsidian", "plugins", "plugin-share-linker", "manifest.json"), {
    id: "plugin-share-linker",
    name: "Share Linker",
    version: "1.0.2",
  });

  writeFile(path.join(VAULT_A, ".obsidian", "themes", "Blue Topaz", "theme.css"), "/* blue topaz */");
  writeJson(path.join(VAULT_A, ".obsidian", "themes", "Blue Topaz", "manifest.json"), {
    name: "Blue Topaz",
    version: "2023080203",
    minAppVersion: "1.0.0",
    author: "WhyI",
  });
  writeFile(path.join(VAULT_A, ".obsidian", "themes", "legacy", "theme.css"), "/* legacy, no manifest */");
  writeFile(path.join(VAULT_A, ".obsidian", "themes", "obsidian.css"), "/* stray file, must be ignored */");

  writeFile(path.join(VAULT_A, ".obsidian", "snippets", "wide-tables.css"), ".wide-table { width: 100%; }");
  writeFile(path.join(VAULT_A, ".obsidian", "snippets", "callout-tweaks.css"), ".callout { border: 0; }");
  writeFile(path.join(VAULT_A, ".obsidian", "snippets", "notes.txt"), "not a snippet");
  writeFile(path.join(VAULT_A, ".obsidian", "snippets", ".hidden.css"), ".hidden {}");

  // Target vault (B) - already a vault, with its own enabled plugin and appearance
  writeJson(path.join(VAULT_B, ".obsidian", "community-plugins.json"), ["other-plugin"]);
  writeJson(path.join(VAULT_B, ".obsidian", "appearance.json"), { theme: "moonstone", cssTheme: "" });

  // Target folder (C) - exists but is not a vault yet
}

async function main() {
  setupVaults();

  const Ctor = require(MAIN_JS);
  const app = {
    vault: { adapter: { getBasePath: () => VAULT_A }, configDir: ".obsidian" },
    setting: null,
  };
  const plugin = new Ctor(app, { id: "plugin-share-linker", name: "Share Linker" });
  await plugin.onload();
  plugin.settings.language = "zh";

  // --- Listing -------------------------------------------------------------
  const plugins = await plugin.listPlugins();
  eq("listPlugins finds dataview + templater", plugins.map((item) => item.id), ["dataview", "templater-obsidian"]);
  check("listPlugins skips broken plugin folder", !plugins.some((item) => item.folderName === "broken-plugin"));
  check("listPlugins skips itself", !plugins.some((item) => item.folderName === "plugin-share-linker"));

  const themes = await plugin.listThemes();
  eq("listThemes finds folder themes, ignores stray css", themes.map((item) => item.folderName), ["Blue Topaz", "legacy"]);
  eq("listThemes uses manifest name", themes[0].name, "Blue Topaz");
  eq("listThemes falls back to folder name", themes[1].name, "legacy");

  const snippets = await plugin.listSnippets();
  eq("listSnippets finds css files only", snippets.map((item) => item.name), ["callout-tweaks", "wide-tables"]);

  // --- Plugin copy + enable ------------------------------------------------
  plugin.settings.targetVaultPath = VAULT_B;
  plugin.settings.selectedPluginIds = ["dataview"];
  plugin.settings.enabledPluginIds = ["dataview", "templater-obsidian"];

  const firstShare = await plugin.copyPlugins(["dataview"], VAULT_B);
  eq("plugin copy status", firstShare.results.map((item) => item.status), ["created"]);
  check("plugin copied", fs.existsSync(path.join(VAULT_B, ".obsidian", "plugins", "dataview", "manifest.json")));
  check(
    "plugin data.json copied (settings travel with the folder)",
    fs.existsSync(path.join(VAULT_B, ".obsidian", "plugins", "dataview", "data.json"))
  );
  eq(
    "enable list appended only for landed+enabled",
    readJson(path.join(VAULT_B, ".obsidian", "community-plugins.json")),
    ["other-plugin", "dataview"]
  );
  eq("enable summary", firstShare.config.pluginsEnabled, ["dataview"]);
  check("community-plugins backup created", fs.existsSync(path.join(VAULT_B, ".obsidian", "community-plugins.json.bak")));
  eq(
    "backup holds original content",
    readJson(path.join(VAULT_B, ".obsidian", "community-plugins.json.bak")),
    ["other-plugin"]
  );

  // Re-share: exists, no overwrite, message says not updated
  const secondShare = await plugin.copyPlugins(["dataview"], VAULT_B);
  eq("re-share status is exists", secondShare.results.map((item) => item.status), ["exists"]);
  check("re-share message says not updated", secondShare.results[0].message.includes("未更新"), secondShare.results[0].message);
  eq(
    "community list unchanged on re-share",
    readJson(path.join(VAULT_B, ".obsidian", "community-plugins.json")),
    ["other-plugin", "dataview"]
  );

  // Enable an already-existing plugin: exists still counts as landed
  writeJson(path.join(VAULT_B, ".obsidian", "community-plugins.json"), ["other-plugin"]);
  plugin.settings.enabledPluginIds = ["dataview"];
  const thirdShare = await plugin.copyPlugins(["dataview"], VAULT_B);
  eq("exists counts as landed for enable", thirdShare.config.pluginsEnabled, ["dataview"]);
  eq(
    "community list rebuilt with landed id",
    readJson(path.join(VAULT_B, ".obsidian", "community-plugins.json")),
    ["other-plugin", "dataview"]
  );

  // --- Themes --------------------------------------------------------------
  plugin.settings.targetThemeName = "";
  const themeShare = await plugin.copyThemes(["Blue Topaz"], VAULT_B);
  eq("theme copy status", themeShare.results.map((item) => item.status), ["created"]);
  check("theme folder copied", fs.existsSync(path.join(VAULT_B, ".obsidian", "themes", "Blue Topaz", "theme.css")));
  eq(
    "auto theme set when target has no custom theme",
    readJson(path.join(VAULT_B, ".obsidian", "appearance.json")).cssTheme,
    "Blue Topaz"
  );
  check("appearance backup created", fs.existsSync(path.join(VAULT_B, ".obsidian", "appearance.json.bak")));
  eq("theme summary", themeShare.config.themeSet, "Blue Topaz");

  // Re-share theme: exists status; target already has a custom theme, so no config write
  const themeReshare = await plugin.copyThemes(["Blue Topaz"], VAULT_B);
  eq("theme re-share status exists", themeReshare.results.map((item) => item.status), ["exists"]);
  eq("no config write when target already has a theme", themeReshare.config, null);

  // Explicit pick overrides an existing target theme
  const appearanceAfter = readJson(path.join(VAULT_B, ".obsidian", "appearance.json"));
  appearanceAfter.cssTheme = "Minimal";
  writeJson(path.join(VAULT_B, ".obsidian", "appearance.json"), appearanceAfter);
  fs.rmSync(path.join(VAULT_B, ".obsidian", "themes", "Blue Topaz"), { recursive: true, force: true });
  plugin.settings.targetThemeName = "Blue Topaz";
  const themeOverride = await plugin.copyThemes(["Blue Topaz"], VAULT_B);
  eq(
    "explicit theme overrides target theme",
    readJson(path.join(VAULT_B, ".obsidian", "appearance.json")).cssTheme,
    "Blue Topaz"
  );
  eq("explicit theme summary", themeOverride.config.themeSet, "Blue Topaz");

  // --- Snippets ------------------------------------------------------------
  plugin.settings.selectedSnippetNames = ["wide-tables"];
  plugin.settings.enabledSnippetNames = ["wide-tables", "callout-tweaks"];
  const snippetShare = await plugin.copySnippets(["wide-tables"], VAULT_B);
  eq("snippet copy status", snippetShare.results.map((item) => item.status), ["created"]);
  check("snippet file copied", fs.existsSync(path.join(VAULT_B, ".obsidian", "snippets", "wide-tables.css")));
  const appearanceWithSnippets = readJson(path.join(VAULT_B, ".obsidian", "appearance.json"));
  eq("snippet enabled append", appearanceWithSnippets.enabledCssSnippets, ["wide-tables"]);
  eq("theme untouched by snippet write", appearanceWithSnippets.cssTheme, "Blue Topaz");
  eq("snippet summary", snippetShare.config.snippetsEnabled, ["wide-tables"]);

  // Re-share snippets: enabled already present, so no config rewrite
  const snippetReshare = await plugin.copySnippets(["wide-tables"], VAULT_B);
  eq("snippet re-share status exists", snippetReshare.results.map((item) => item.status), ["exists"]);
  eq("no config write when snippet already enabled", snippetReshare.config, null);

  // --- Broken JSON in target config ---------------------------------------
  writeFile(path.join(VAULT_B, ".obsidian", "community-plugins.json"), "{ this is not json");
  plugin.settings.enabledPluginIds = ["templater-obsidian"];
  const brokenShare = await plugin.copyPlugins(["templater-obsidian"], VAULT_B);
  eq(
    "broken JSON treated as empty",
    readJson(path.join(VAULT_B, ".obsidian", "community-plugins.json")),
    ["templater-obsidian"]
  );
  check("broken JSON backed up", fs.existsSync(path.join(VAULT_B, ".obsidian", "community-plugins.json.bak")));
  eq(
    "broken JSON backup holds original",
    fs.readFileSync(path.join(VAULT_B, ".obsidian", "community-plugins.json.bak"), "utf8"),
    "{ this is not json"
  );
  check(
    "broken JSON warning reported",
    brokenShare.config.warnings.some((warning) => warning.includes("不是有效的 JSON")),
    JSON.stringify(brokenShare.config.warnings)
  );

  // --- Target folder that is not a vault ----------------------------------
  const nonVaultShare = await plugin.copyPlugins(["dataview"], VAULT_C);
  check("non-vault target reports isVault=false", nonVaultShare.target.isVault === false);
  check(
    "non-vault target gets .obsidian created",
    fs.existsSync(path.join(VAULT_C, ".obsidian", "plugins", "dataview", "manifest.json"))
  );

  // --- Errors --------------------------------------------------------------
  await expectThrows("rejects current vault as target", () => plugin.copyPlugins(["dataview"], VAULT_A), "不能是当前 Vault");
  await expectThrows("rejects empty target path", () => plugin.copyPlugins(["dataview"], "   "), "请输入目标");
  await expectThrows("rejects missing target", () => plugin.copyPlugins(["dataview"], path.join(WORK, "nope")), "不存在");
  await expectThrows("requires selected plugin", () => plugin.copyPlugins([], VAULT_B), "请至少选择一个插件");
  await expectThrows("requires selected theme", () => plugin.copyThemes([], VAULT_B), "请至少选择一个主题");
  await expectThrows("requires selected snippet", () => plugin.copySnippets([], VAULT_B), "请至少选择一个 CSS 片段");

  // --- Symlink mode (needs the OS privilege; skipped when unavailable) ----
  fs.rmSync(path.join(VAULT_B, ".obsidian", "plugins", "dataview"), { recursive: true, force: true });
  plugin.settings.enabledPluginIds = [];
  const linkShare = await plugin.createLinks(["dataview"], VAULT_B);
  const linkPath = path.join(VAULT_B, ".obsidian", "plugins", "dataview");
  if (linkShare.results[0].status === "created" && fs.lstatSync(linkPath).isSymbolicLink()) {
    const linkTarget = fs.readlinkSync(linkPath);
    check("symlink created", true);
    check(
      "symlink target is absolute",
      path.isAbsolute(linkTarget) && path.resolve(linkTarget) === path.resolve(VAULT_A, ".obsidian", "plugins", "dataview"),
      linkTarget
    );
  } else {
    console.log("SKIP symlink assertions (status=" + linkShare.results[0].status + " message=" + linkShare.results[0].message + ")");
  }

  // --- Quick sanity on the exported class ---------------------------------
  check("plugin is an instance of the stubbed Plugin", plugin instanceof require("obsidian").Plugin);

  console.log("\n" + (checks - failures) + "/" + checks + " checks passed");
  if (failures > 0) {
    console.log(failures + " FAILED");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("TEST CRASH", error);
  process.exit(2);
});
