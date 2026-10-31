class Plugin {
  constructor(app, manifest) {
    this.app = app;
    this.manifest = manifest;
    this.settings = {};
    this.__saved = null;
  }
  async loadData() {
    return this.__data || null;
  }
  async saveData(data) {
    this.__saved = data;
  }
  addSettingTab() {}
  addCommand() {}
}

class PluginSettingTab {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
  }
}

class Setting {
  setName() {
    return this;
  }
  setDesc() {
    return this;
  }
  addText() {
    return this;
  }
}

class ButtonComponent {
  constructor() {
    this.buttonEl = { addClass() {}, createSpan() {} };
  }
  setIcon() {
    return this;
  }
  setCta() {
    return this;
  }
  onClick() {
    return this;
  }
  setDisabled() {
    return this;
  }
}

class Notice {
  constructor(message) {
    this.message = message;
  }
}

module.exports = { Plugin, PluginSettingTab, Setting, ButtonComponent, Notice };
