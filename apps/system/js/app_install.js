'use strict';

var AppInstallManager = {

  init: function ai_init() {
    this.dialog = document.getElementById('app-install-dialog');
    this.msg = document.getElementById('app-install-message');
    this.size = document.getElementById('app-install-size');
    this.authorName = document.getElementById('app-install-author-name');
    this.authorUrl = document.getElementById('app-install-author-url');
    this.installButton = document.getElementById('app-install-install-button');
    this.cancelButton = document.getElementById('app-install-cancel-button');

    window.addEventListener('mozChromeEvent',
      (function ai_handleChromeEvent(e) {
      if (e.detail.type == 'webapps-ask-install') {
        this.handleAppInstallPrompt(e.detail);
      }
    }).bind(this));

    this.installButton.addEventListener('click', this.handleInstall.bind(this));
    this.cancelButton.addEventListener('click', this.handleCancel.bind(this));
  },

  handleAppInstallPrompt: function ai_handleInstallPrompt(detail) {

    // updateManifest is used by packaged apps until they are installed
    var manifest = detail.app.manifest ?
      detail.app.manifest : detail.app.updateManifest;

    if (!manifest)
      return;

    // display app install dialog
    this.dialog.classList.add('visible');

    var id = detail.id;

    if (manifest.size) {
      this.size.textContent = this.humanizeSize(manifest.size);
    } else {
      this.size.textContent = navigator.mozL10n.get('unknown');
    }

    // Get localised name or use default
    var name = manifest.name;
    var locales = manifest.locales;
    var lang = navigator.language;
    if (locales && locales[lang] && locales[lang].name)
      name = locales[lang].name;
    var msg = navigator.mozL10n.get('install-app', {'name': name});
    this.msg.textContent = msg;

    if (manifest.developer) {
      this.authorName.textContent = manifest.developer.name;
      this.authorUrl.textContent = manifest.developer.url;
    } else {
      this.authorName.textContent = navigator.mozL10n.get('unknown');
      this.authorUrl.textContent = '';
    }

    this.installCallback = (function ai_installCallback() {
      this.dispatchResponse(id, 'webapps-install-granted');
    }).bind(this);

  },

  handleInstall: function ai_handleInstall() {
    if (this.installCallback)
      this.installCallback();
    this.installCallback = null;
    this.dialog.classList.remove('visible');
  },

  handleCancel: function ai_handleCancel() {
    this.dialog.classList.remove('visible');
  },

  dispatchResponse: function ai_dispatchResponse(id, type) {
    var event = document.createEvent('CustomEvent');

    event.initCustomEvent('mozContentEvent', true, true, {
      id: id,
      type: type
    });

    window.dispatchEvent(event);
  },

  humanizeSize: function ai_humanizeSize(bytes) {
    var units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB'];
    var e = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, Math.floor(e))).toFixed(2) + ' ' + units[e];
  }

};

AppInstallManager.init();
