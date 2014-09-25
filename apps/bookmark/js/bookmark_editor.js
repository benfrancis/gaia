'use strict';

/* global UrlHelper, BookmarksDatabase, Icon, WebManifestHelper */
/* exported BookmarkEditor */

var BookmarkEditor = {
  init: function bookmarkEditor_show(options) {
    this.data = options.data;
    this.onsaved = options.onsaved;
    this.oncancelled = options.oncancelled;
    var mode = 'add';
    BookmarksDatabase.get(this.data.url).then((function got(bookmark) {
      if (bookmark) {
        this.data = bookmark;
        mode = 'put';
      }
      this._init(mode);
    }).bind(this), this._init.bind(this, mode));
  },

  _init: function bookmarkEditor_init(mode) {
    this.mode = document.body.dataset.mode = mode;
    this.bookmarkTitle = document.getElementById('bookmark-title');
    this.bookmarkIcon = document.getElementById('bookmark-icon');
    this.cancelButton = document.getElementById('cancel-button');
    this.saveButton = document.getElementById('done-button');
    this.appInstallationSection = document.getElementById('app-installation');

    this.cancelButton.addEventListener('click', this.close.bind(this));
    this.saveListener = this.save.bind(this);
    this.saveButton.addEventListener('click', this.saveListener);

    this.bookmarkTitle.value = this.data.name || '';

    this._renderIcon();
    
    if (this.data.manifestURL) {
      this.manifestURL = this.data.manifestURL;
      this._getManifest(this.manifestURL);
      this.installAppSwitch = document.getElementById('install-app-switch');
      this.installAppSwitch.addEventListener('click',
        this._handleAppSwitchClick.bind(this));
    }

    this._checkDoneButton();
    this.form = document.getElementById('bookmark-form');
    this.form.addEventListener('input', this._checkDoneButton.bind(this));
    this.form.addEventListener('submit', this._submit.bind(this));
    var touchstart = 'ontouchstart' in window ? 'touchstart' : 'mousedown';
    this.clearButton = document.getElementById('bookmark-title-clear');
    this.clearButton.addEventListener(touchstart, this._clearTitle.bind(this));
    if (mode === 'put') {
      this._onEditMode();
    }

    // We're appending new elements to DOM so to make sure headers are
    // properly resized and centered, we emmit a lazyload event.
    // This will be removed when the gaia-header web component lands.
    window.dispatchEvent(new CustomEvent('lazyload', {
      detail: document.body
    }));
  },

  _renderIcon: function renderIcon() {
    var icon = new Icon(this.bookmarkIcon, this.data.icon);
    icon.render();
  },
  
  _getManifest: function bookmarkEditor_getManifest(manifestURL) {
    WebManifestHelper.getManifest(manifestURL).then(manifestData => {
      if (manifestData) {
        this.appInstallationSection.classList.remove('hidden');
        this.manifest = manifestData;
      }
    }, function(error) {
    console.error('Unable to get web manifest: ' + error);
    });
  },

  _onEditMode: function bookmarkEditor_onEditMode() {
    // Done button will be disabled on edit mode once it is displayed
    this.saveButton.disabled = true;
  },

  close: function bookmarkEditor_close() {
    this.oncancelled();
  },

  /**
   * Handles the submit case for the form when the user presses the enter key.
   * @param {Event} event The form submit event.
   */
  _submit: function(event) {
    event.preventDefault();
    this.save();
  },

  _clearTitle: function bookmarkEditor_clearTitle(event) {
    event.preventDefault();
    this.bookmarkTitle.value = '';
    this._checkDoneButton();
  },

  _checkDoneButton: function bookmarkEditor_checkDoneButton() {
    // If one of the ﬁelds is blank, the “Done” button should be dimmed and
    // inactive
    var title = this.bookmarkTitle.value.trim();
    this.saveButton.disabled = title === '';
  },
  
  _handleAppSwitchClick: function bookmarkEditor_handleAppSwitchClick(e) {
    if (e.target.checked) {
      this.bookmarkTitle.value = this.manifest.short_name ||
        this.manifest.name || this.data.name || '';
      this.appRequested = true;
    } else {
      this.bookmarkTitle.value = this.data.name || '';
      this.appRequested = false;
    }
  },

  save: function bookmarkEditor_save(evt) {
    this.saveButton.removeEventListener('click', this.saveListener);
    
    // If app installation requested, install app
    if (this.appRequested) {
      this.oncancelled();
      window.navigator.mozApps.install(this.manifestURL);
      return;
    }

    // Only allow urls to be bookmarked.
    // This is defensive check - callers should filter out non-URLs.
    var url = this.data.url.trim();
    if (UrlHelper.isNotURL(url)) {
      this.oncancelled();
      return;
    }

    this.data.name = this.bookmarkTitle.value;
    this.data.url = url;

    BookmarksDatabase[this.mode](this.data).then(this.onsaved.bind(this),
                                                 this.close.bind(this));
  }
};
