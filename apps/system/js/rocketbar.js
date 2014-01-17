'use strict';

var Rocketbar = {

  enabled: false,

  /**
   * Either 'search' or 'tasks'.
   * Let us know how the rocketbar was opened.
   */
  home: 'search',

  /**
   * How much room on the statusbar will trigger the rocketbar
   * when tapped on.
   */
  triggerWidth: 0.67,

  /**
   * Minimum swipe to activate the task manager.
   * This is a % of the total screen height.
   */
  swipeThreshold: 0.10,

  /**
   * Current pointer position of a statusbar swipe.
   */
  pointerY: 0,

  /**
   * Height of the screen.
   * Currently passed into and populated by the render method.
   */
  screenHeight: 0,

  searchAppURL: null,

  _port: null,

  screen: document.getElementById('screen'),

  results: document.getElementById('rocketbar-results'),

  input: document.getElementById('rocketbar-input'),

  cancelButton: document.getElementById('rocketbar-cancel'),

  resetButton: document.getElementById('rocketbar-reset'),

  form: document.getElementById('rocketbar'),

  get shown() {
    return ('visible' in this.searchBar.dataset);
  },

  /**
   * Initlialise Rocketbar
   */
  init: function() {
    // IACHandler will dispatch inter-app messages
    window.addEventListener('iac-search-results',
      this.onSearchMessage.bind(this));

    // Know when to update title
    window.addEventListener('apploading', this);
    window.addEventListener('appforeground', this);
    window.addEventListener('apptitlechange', this);

    window.addEventListener('statusbarexpand', this);

    // Know when window manager transitions to homescreen
    window.addEventListener('home', this.handleHome.bind(this));

    this.input.addEventListener('input', this.handleInput.bind(this));
    this.form.addEventListener('submit', this.handleSubmit.bind(this));
    this.input.addEventListener('focus', this.handleFocus.bind(this));

    window.addEventListener('cardchange', this);
    this.cancelButton.addEventListener('click', this.handleCancel.bind(this));
    // Prevent default on mousedown
    this.resetButton.addEventListener('mousedown', this);
    // Listen to clicks to keep the keyboard up
    this.resetButton.addEventListener('click', this);

    SettingsListener.observe('rocketbar.enabled', false,
    function(value) {
      if (value) {
        document.body.classList.add('rb-enabled');
      } else {
        document.body.classList.remove('rb-enabled');
      }
      this.enabled = value;
    }.bind(this));

    SettingsListener.observe('rocketbar.searchAppURL', false,
    function(url) {
      this.searchAppURL = url;
      this.searchManifestURL = url.match(/(^.*?:\/\/.*?\/)/)[1] +
        'manifest.webapp';
    }.bind(this));
  },

  handleEvent: function(e) {
    switch (e.type) {
      case 'cardchange':
        this.input.value = e.detail.title;

        // Every app/browser has a title.
        // If there is no title, there are no cards shown.
        // We should focus on the rocketbar.
        if (this.shown && !e.detail.title) {
          this.input.focus();
        }
        return;
      case 'keyboardchange':
        // When the keyboard is opened make sure to not resize
        // the current app by swallowing the event.
        e.stopImmediatePropagation();
        return;
      case 'apploading':
      case 'apptitlechange':
      case 'appforeground':
        if (e.detail instanceof AppWindow && e.detail.isActive()) {
          this.input.value = e.detail.title;
        }
        return;
      case 'statusbarexpand':
        this.loadSearchApp();
        this.input.value = '';
        return;
      /*case 'attentionscreenshow':
      case 'home':
      case 'emergencyalert':
      case 'displayapp':
      case 'keyboardchanged':
      case 'keyboardchangecanceled':
      case 'simpinshow':
      case 'appopening':*/

      default:
        break;
    }

    switch (e.target.id) {
      case 'search-cancel':
        e.preventDefault();
        e.stopPropagation();
        // Show the card switcher again if we opened the rocketbar
        // in task manager mode. There needs to be a current card.
        var runningApps = AppWindowManager.getRunningApps();
        if (!this.screen.classList.contains('task-manager') &&
            this.home === 'tasks' && Object.keys(runningApps).length > 1) {
          window.dispatchEvent(new CustomEvent('taskmanagershow'));
          // Send a message to the search app to clear results
          if (this._port) {
            this._port.postMessage({
              action: 'clear'
            });
          }
        } else {
          window.dispatchEvent(new CustomEvent('taskmanagerhide'));
          this.hide();
        }
        break;
      case 'search-reset':
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('taskmanagerhide'));
        this.input.value = '';
        this.resetButton.classList.add('hidden');
        break;
      case 'search-input':
        window.dispatchEvent(new CustomEvent('taskmanagerhide'));
        // If the current text is not a URL, clear it.
        if (UrlHelper.isNotURL(this.input.value)) {
          this.input.value = '';
        }
        break;
      default:
        break;
    }
  },

  /**
   * Inserts the search app iframe into the dom.
   */
  loadSearchApp: function() {
    var results = this.results;
    var searchFrame = results.querySelector('iframe');

    // If there is already a search frame, tell it that it is
    // visible and bail out.
    if (searchFrame) {
      searchFrame.setVisible(true);
      return;
    }

    searchFrame = document.createElement('iframe');
    searchFrame.src = this.searchAppURL;
    searchFrame.setAttribute('mozapptype', 'mozsearch');
    searchFrame.setAttribute('mozbrowser', 'true');
    searchFrame.setAttribute('remote', 'true');
    searchFrame.setAttribute('mozapp', this.searchManifestURL);
    searchFrame.classList.add('hidden');

    results.appendChild(searchFrame);

    searchFrame.addEventListener('mozbrowsererror', function() {
      results.removeChild(searchFrame);
    });

    searchFrame.addEventListener('mozbrowserloadend', function() {
      searchFrame.classList.remove('hidden');
    });

    this.initSearchConnection();
  },

  initSearchConnection: function() {
    var self = this;
    navigator.mozApps.getSelf().onsuccess = function() {
      var app = this.result;
      app.connect('search').then(
        function onConnectionAccepted(ports) {
          ports.forEach(function(port) {
            self._port = port;
          });
          if (self.pendingEvent) {
            self.onSearchMessage(self.pendingEvent);
            delete self.pendingEvent;
          }
        },
        function onConnectionRejected(reason) {
          dump('Error connecting: ' + reason + '\n');
        }
      );
    };
  },

  onSearchMessage: function(e) {
    // Open the search connection if we receive a message before it's open
    if (!this._port) {
      this.pendingEvent = e;
      this.initSearchConnection();
      return;
    }

    var detail = e.detail;
    if (detail.action) {
      this[detail.action]();
    } else if (detail.input) {
      var input = this.input;
      input.value = detail.input;
      this._port.postMessage({ action: 'change', input: input.value });
    }
  },

  /**
   * Hides the rocketbar.
   * @param {String} event type that triggers the hide.
   */
  hide: function(evtType) {
    if (!this.shown)
      return;

    if (evtType === 'appopening') {
      this.searchBar.style.display = 'none';
    }

    document.body.removeEventListener('keyboardchange', this, true);

    this.searchInput.blur();

    var searchFrame = this.results.querySelector('iframe');
    if (searchFrame) {
      searchFrame.setVisible(false);
    }
    delete this.searchBar.dataset.visible;

    window.dispatchEvent(new CustomEvent('rocketbarhidden'));
  },

  /**
   * Renders the rocketbar.
   * @param {Integer} height of the screen in pixels.
   */
  render: function(height) {
    this.screenHeight = height;
    if (this.shown) {
      return;
    }

    // If we have a port, send a message to clear the search app
    if (this._port) {
      this._port.postMessage({
        action: 'clear'
      });
    }

    document.body.addEventListener('keyboardchange', this, true);

    this.searchReset.classList.add('hidden');

    // We need to ensure the rocketbar is visible before we transition it.
    // This is why we wait for the next tick to start the traisition.
    this.searchBar.style.display = 'block';
    setTimeout(this.startTransition.bind(this));
  },

  showResults: function() {
    this.results.classList.remove('hidden');
  },

  hideResults: function() {
    this.results.classList.add('hidden');
  },

  /**
   * Handle Rocketbar text input.
   *
   * @param {Event} e The input event.
   */
  handleInput: function(e) {
    if (!this.input.value) {
        this.resetButton.classList.add('hidden');
      } else {
        this.resetButton.classList.remove('hidden');
      }
      this._port.postMessage({
        action: 'change',
        input: this.input.value
      });
  },

  /**
   * Handle Rocketbar cancel button press.
   *
   * @param {Event} e The click event.
   */
  handleCancel: function(e) {
    StatusBar.collapse();
    this.input.value = '';
    this.hideResults();
  },

  /**
   * Handle Rocketbar form submission.
   *
   * @param {Event} e The submit event.
   */
  handleSubmit: function(e) {
    e.preventDefault();
    this._port.postMessage({
      action: 'submit',
      input: this.input.value
    });
  },

  /**
   * Handle focus on Rocketbar input.
   *
   * @param {Event} e The focus event.
   */
  handleFocus: function(e) {
    this.input.value = '';
    this.showResults();
  },

  /**
   * Handle a home event when the window manager switches to the homescreen.
   *
   * @param {Event} e The home event.
   */
  handleHome: function(e) {
    StatusBar.collapse();
    this.input.value = '';
    this.hideResults();
  },

  /**
   * Starts the transition of the rocketbar
   */
  startTransition: function() {
    var search = this.searchBar;
    search.dataset.visible = 'true';
    search.style.visibility = 'visible';

    var input = this.searchInput;
    input.value = '';

    window.dispatchEvent(new CustomEvent('rocketbarshown'));

    var self = this;
    search.addEventListener('transitionend', function shown(e) {
      search.removeEventListener(e.type, shown);

      if (self.pointerY > self.swipeThreshold * self.screenHeight) {
        self.home = 'tasks';
        window.dispatchEvent(new CustomEvent('taskmanagershow'));
      } else {
        self.home = 'search';
        // Only focus for search views
        input.focus();
      }
      self.loadSearchApp();
    });
  }
};

Rocketbar.init();
