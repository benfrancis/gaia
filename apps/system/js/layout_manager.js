'use strict';

(function(window) {
  var DEBUG = false;
  window.LayoutManager = {
    get clientWidth() {
      if (this._clientWidth)
        return this._clientWidth;

      this._clientWidth = document.documentElement.clientWidth;
      return this._clientWidth;
    },

    get fullscreenHeight() {
      return window.innerHeight -
        (this.keyboardEnabled ? KeyboardManager.getHeight() : 0);
    },

    get usualHeight() {
      return window.innerHeight -
        (this.keyboardEnabled ? KeyboardManager.getHeight() : 0) -
        SoftwareButtonManager.height - StatusBar.height;
    },

    get width() {
      return window.innerWidth;
    },

    match: function(width, height, isFullScreen) {
      if (isFullScreen) {
        return (this.fullscreenHeight === height);
      } else {
        return (this.usualHeight === height);
      }
    },

    keyboardEnabled: false,

    init: function lm_init() {
      window.addEventListener('resize', this);
      window.addEventListener('status-active', this);
      window.addEventListener('status-inactive', this);
      window.addEventListener('keyboardchange', this);
      window.addEventListener('keyboardhide', this);
      window.addEventListener('attentionscreenhide', this);
      window.addEventListener('mozfullscreenchange', this);
      window.addEventListener('software-button-enabled', this);
      window.addEventListener('software-button-disabled', this);
    },

    handleEvent: function lm_handleEvent(evt) {
      this.debug('resize event got: ', evt.type);
      switch (evt.type) {
        case 'keyboardchange':
          if (document.mozFullScreen)
            document.mozCancelFullScreen();
          this.keyboardEnabled = true;
          this.publish('system-resize');
          break;
        default:
          if (evt.type === 'keyboardhide')
            this.keyboardEnabled = false;
          this.publish('system-resize');
          break;
      }
    },

    publish: function lm_publish(event, detail) {
      var evt = document.createEvent('CustomEvent');
      evt.initCustomEvent(event, true, false, detail || this);

      this.debug('publish: ' + event);
      window.dispatchEvent(evt);
    },

    debug: function lm_debug() {
      if (DEBUG) {
        console.log('[LayoutManager]' +
          '[' + System.currentTime() + ']' +
          Array.slice(arguments).concat());
      }
    }
  };

  LayoutManager.init();
}(this));
