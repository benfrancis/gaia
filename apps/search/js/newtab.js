'use strict';

/* globals AccessibilityHelper */

(function(exports) {

  /**
   * The main Newtab page object.
   * Instantiates places to populate history and top sites.
   */

  function Newtab() {

    // Initialize the parent port connection
    var self = this;
    var tabsIds = ['top-sites-header', 'top-pages-header', 'history-header'];
    var tabs = [];

    tabsIds.forEach(function(tabId) {
      var current = document.getElementById(tabId);
      tabs.push(current);
      current.addEventListener('click', function(evt) {
        evt.preventDefault();
        AccessibilityHelper.setAriaSelected(current, tabs);
      });
    });

    navigator.mozApps.getSelf().onsuccess = function() {
      var app = this.result;
      app.connect('search-results').then(function onConnAccepted(ports) {
        ports.forEach(function(port) {
          self._port = port;
        });
        self.init();
      }, function onConnectionRejected(reason) {
        console.log('Error connecting: ' + reason + '\n');
      });
    };
  }

  Newtab.prototype = {

    /**
     * A reference to the Places provider.
     */
    provider: null,

    /**
     * Initializes top sites and history.
     */
    init: function() {
      this.provider.init();
      this.provider.searchObj = this;
    },

    /**
     * Requests a screenshot of the page from the system app.
     */
    requestScreenshot: function(url) {
      this._port.postMessage({
        'action': 'request-screenshot',
        'url': url
      });
    },

    /**
     * Requests that the system app opens a new private window.
     */
    requestPrivateWindow: function() {
      this._port.postMessage({
        'action': 'private-window'
      });
    },
  };

  exports.newtab = new Newtab();

  /**
   * Stub search object to populate providers.
   * TODO: We should split up the places provider into some data layer where
   * the search or newtab page could leverage it.
   */
  exports.Search = {
    provider: function(provider) {
      exports.newtab.provider = provider;
    },

    /**
     * Opens a browser to a URL.
     * @param {String} url The url to navigate to
     */
    navigate: function(url) {
      window.open(url, '_blank', 'remote=true');
    }
  };

})(window);
