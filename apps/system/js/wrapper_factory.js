/**
 * WrapperFactory deals with opening a window for bookmarked web page.
 * Usually the request is coming from homescreen app.
 */

'use strict';

(function(window) {
  var WrapperFactory = {
    init: function wf_init() {
      window.addEventListener('mozbrowseropenwindow', this, true);
      // Use capture in order to catch the event before PopupManager does
    },

    handleEvent: function wf_handleEvent(evt) {
      var detail = evt.detail;

      // If it's a normal window.open request, ignore.
      if (typeof detail.features !== 'string')
        return;

      // Turn ',' separated 'key=value' string into object for easy access
      var features = detail.features
        .split(',')
        .reduce(function(acc, feature) {
          feature = feature
            .split('=')
            .map(function(featureElem) { return featureElem.trim(); });
          if (feature.length !== 2)
            return acc;

          acc[decodeURIComponent(feature[0])] = decodeURIComponent(feature[1]);
          return acc;
        }, {});

      // Handles only call to window.open with `remote=true` feature.
      if (!('remote' in features) || features['remote'] !== 'true')
        return;

      // Examine permission
      // XXX: Ask app window about this.
      var callerIframe = evt.target;
      var callerFrame = callerIframe.parentNode;
      var manifestURL = callerIframe.getAttribute('mozapp');
      var callerApp = Applications.getByManifestURL(manifestURL);
      if (!this.hasPermission(callerApp, 'open-remote-window'))
        return;

      // So, we are going to open a remote window.
      // Now, avoid PopupManager listener to be fired.
      evt.stopImmediatePropagation();

      var callerOrigin = callerApp.origin;
      var name = detail.name;
      var url = detail.url;

      // Use fake origin for named windows in order to be able to reuse them,
      // otherwise always open a new window for '_blank'.
      var origin = null;
      var app = null;
      var runningApps = AppWindowManager.runningApps;
      if (name == '_blank') {
        origin = url;

        // Just bring on top if a wrapper window is
        // already running with this url.
        if (origin in runningApps &&
            runningApps[origin].windowName == '_blank') {
          this.publish('displayapp', { origin: origin });
        }
      } else {
        origin = 'window:' + name + ',source:' + callerOrigin;

        var runningApp = runningApps[origin];
        if (runningApp && runningApp.windowName === name) {
          if (runningApp.iframe.src === url) {
            // If the url is already loaded, just display the app
            this.publish('displayapp', { origin: origin });
            return;
          } else {
            // Wrapper context shouldn't be shared between two apps -> killing
            this.publish('killapp', { origin: origin });
          }
        }
      }

      // TODO: Put this into browser_config_helper.
      var browser_config = this.generateBrowserConfig(features);

      // If we don't reuse an existing app, open a brand new one
      browser_config.url = url;
      browser_config.origin = origin;
      browser_config.windowName = name;
      if (!browser_config.title)
        browser_config.title = url;

      this.launchWrapper(browser_config);
    },

    launchWrapper: function wf_launchWrapper(config) {
      var app = AppWindowManager.runningApps[config.origin];
      var iframe;
      if (!app) {
        app = new AppWindow(config);
      } else {
        iframe = app.iframe;

        // XXX: Move this into app window.
        // Do not touch the name here directly.
        // Update app name for the card view
        app.manifest ? (app.manifest.name = config.title) :
                        (app.name = config.title);
      }

      this.publish('displayapp', { origin: config.origin });
    },

    hasPermission: function wf_hasPermission(app, permission) {
      var mozPerms = navigator.mozPermissionSettings;
      if (!mozPerms)
        return false;

      var value = mozPerms.get(permission, app.manifestURL, app.origin, false);

      return (value === 'allow');
    },

    generateBrowserConfig: function wf_generateBrowserConfig(features) {
      var config = {};
      config.title = features.name;
      config.icon = features.icon || '';

      if ('originName' in features) {
        config.originName = features.originName;
        config.originURL = features.originUrl;
      }

      if ('searchName' in features) {
        config.searchName = features.searchName;
        config.searchURL = features.searchUrl;
      }

      if ('useAsyncPanZoom' in features &&
          features.useAsyncPanZoom === 'true') {
        config.useAsyncPanZoom = true;
      } else {
        config.useAsyncPanZoom = false;
      }

      config.chrome = {};
  
      // Rocketbar is not displayed by default
      if ('location' in features &&
          (features.location == 'yes') ||  features.location == '1') {
        console.log('MSG rocketbar turned on');
        config.chrome.rocketbar = true;
      } else {
        config.chrome.rocketbar = false;
        console.log('MSG rocketbar not turned on');
      }

      // Navigation bar is displayed by default
      if ('toolbar' in features &&
          (features.toolbar == 'no' || features.toolbar == '0' )) {
        console.log('MSG toolbar not turned on');
        config.chrome.toolbar = false;
      } else {
        console.log('MSG toolbar turned on');
        config.chrome.toolbar = true;
      }

      return config;
    },

    publish: function wf_publish(event, detail) {
      var evt = new CustomEvent(event, { detail: detail });
      window.dispatchEvent(evt);
    }
  };

  WrapperFactory.init();
}(this));
