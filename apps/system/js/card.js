/* globals BaseUI, CardsHelper, Tagged */
/* exported Card */

'use strict';

(function(exports) {

  var _id = 0;

  /* Corresponds to the icon size in the footer.
   * Used to determine the proper icon size from the manifest.
   */
  const CARD_FOOTER_ICON_SIZE = 40;

  /**
   * A card in a card view, representing a single app
   *
   * @class Card
   * @param {Object} config config to associate the card with a given app and
   *                        how it should be displayed
   * @extends BaseUI
   */
  function Card(config) {
    if (config) {
      for (var key in config) {
        this[key] = config[key];
      }
    }

    this.instanceID = _id++;

    return this;
  }

  Card.prototype = Object.create(BaseUI.prototype);
  Card.prototype.constructor = Card;

  /**
   * @type {String}
   * @memberof Card.prototype
   */
  Card.prototype.EVENT_PREFIX = 'card-';

  /**
   * The instance's element will get appended here if defined
   * @type {DOMNode}
   * @memberof Card.prototype
   */
  Card.prototype.containerElement = null;

  Card.prototype.CLASS_NAME = 'Card';
  Card.prototype.element = null;

  /**
   * CSS visibility value to show/hide close button for this app
   * @type {String}
   * @memberof Card.prototype
   */
  Card.prototype.closeButtonVisibility = 'hidden';

  /**
   * CSS visibility value to show/hide favorite button for this app
   * @type {String}
   * @memberof Card.prototype
   */
  Card.prototype.favoriteButtonVisibility = 'hidden';

  /**
   * Debugging helper to output a useful string representation of an instance.
   * @memberOf Card.prototype
  */
  Card.prototype.toString = function() {
    return '[' + this.CLASS_NAME + ' ' +
            this.position + ':' + this.cardTitle + ']';
  };

  /**
   * Get cached setting boolean value for whether to use screenshots or
   * icons in cards
   * @memberOf Card.prototype
   */
  Card.prototype.getScreenshotPreviewsSetting = function() {
    return this.manager.useAppScreenshotPreviews;
  };


  /**
   * Template string representing the innerHTML of the instance's element
   * @memberOf Card.prototype
   */
  Card.prototype.template = function() {
    return Tagged.escapeHTML `<div class="titles">
     <h1 dir="auto" class="title page-title">${this.pageTitle}</h1>
     <p class="subtitle">
      <span class="subtitle-url">${this.subTitle}</span>
     </p>
    </div>

    <div class="screenshotView bb-button" data-l10n-id="openCard"
      role="link"></div>
    <div class="privateOverlay"></div>
    <div class="appIconView" style="background-image:${this.iconValue}"></div>

    <header class="card-tray">
     <h1 id="${this.titleId}" dir="auto"
         class="card-title title">${this.cardTitle}</h1>
     <button class="appIcon" data-l10n-id="openCard"
       data-button-action="select" aria-hidden="true"></button>
     <menu class="buttonbar">
       <button class="close-button bb-button" data-l10n-id="closeCard"
         data-button-action="close" role="button"
         style="visibility: ${this.closeButtonVisibility}"></button>
      <button class="favorite-button bb-button"
        data-button-action="favorite" role="button"
        style="visibility: ${this.favoriteButtonVisibility}"></button>
     </menu>
    </header>`;
  };

  /**
   * Card html view - builds the innerHTML for a card element
   * @memberOf Card.prototype
   */
  Card.prototype.view = function c_view() {
    return this.template();
  };

  /**
   * Populate properties on the instance before templating
   * @memberOf Card.prototype
   */
  Card.prototype._populateViewData = function() {
    var app = this.app;
    this.cardTitle = app.isBrowser() ? app.name : app.config.name;
    this.pageTitle = (app.isBrowser() && app.title) ? app.title : '';
    this.subTitle = '';
    this.sslState = app.getSSLState();
    this.iconValue = '';
    this.iconPending = true;
    this.closeButtonVisibility = 'visible';
    this.viewClassList = ['card', 'appIconPreview'];
    this.titleId = 'card-title-' + this.instanceID;

    var currentUrl = app.config.url;

    if (app.isPrivate) {
      this.viewClassList.push('private');
    }

    app.getSiteIconUrl(CARD_FOOTER_ICON_SIZE).then(iconUrl => {
      console.log('card for %s, updating iconButton with:', iconUrl);
      this._updateIcon(iconUrl);
    }).catch(err => {
      console.warn('card for %s, error from getSiteIconUrl: %s, ',
                   currentUrl, err);
      this._updateIcon();
    });

    var origin = app.origin;
    var frameForScreenshot = app.getFrameForScreenshot();
    var displayUrl = '';

    if (app.isBrowser()) {
      displayUrl = app.config.url || origin;
      // Do not display the URL when browsing an app page. This is
      // encountered for use-cases like the private browser splash page.
      if (displayUrl.startsWith('app://')) {
        displayUrl = false;
      }

    } else if(frameForScreenshot &&
        CardsHelper.getOffOrigin(frameForScreenshot.src, origin)) {
      displayUrl = CardsHelper.getOffOrigin(frameForScreenshot.src, origin);
    }
    if (displayUrl) {
      this.subTitle = this.getDisplayURLString(displayUrl);
      this.viewClassList.push('show-subtitle');
    }

    var topMostWindow = app.getTopMostWindow();
    if (topMostWindow && topMostWindow.CLASS_NAME === 'TrustedWindow') {
      var name = topMostWindow.name;
      this.cardTitle = CardsHelper.escapeHTML(name || '', true);
      this.viewClassList.push('trustedui');
    } else if (!this.app.killable()) {
      // unclosable app
      this.closeButtonVisibility = 'hidden';
    }
  };

  Card.prototype.move = function(deltaX, deltaY) {
    deltaX = deltaX || 0;
    deltaY = deltaY || 0;

    var windowWidth = this.manager.windowWidth || window.innerWidth;
    var offset = this.position - this.manager.cardPosition;
    var positionX = deltaX + offset * (windowWidth * 0.55);
    var appliedX = positionX;

    var rightLimit =  windowWidth / 2 + windowWidth * 0.24 - 0.001;
    appliedX = Math.min(appliedX, rightLimit);
    appliedX = Math.max(appliedX, -1 * rightLimit);

    this.element.dataset.positionX = positionX;
    this.element.dataset.keepLayerDelta = Math.abs(positionX - appliedX);

    var style = { transform: '' };

    if (deltaX || offset) {
      style.transform = 'translateX(' + appliedX + 'px)';
    }

    if (deltaY) {
      style.transform = 'translateY(' + deltaY + 'px)';
    }

    this.applyStyle(style);
  };

  /**
   * Build a card representation of an app window.
   * @memberOf Card.prototype
   */
  Card.prototype.render = function() {
    this.publish('willrender');

    var elem = this.element || (this.element = document.createElement('li'));
    // we maintain position value on the instance and on the element.dataset
    elem.dataset.position = this.position;
    // we maintain instanceId on the card for unambiguous lookup
    elem.dataset.appInstanceId = this.app.instanceID;
    // keeping origin simplifies ui testing
    elem.dataset.origin = this.app.origin;

    this._populateViewData();

    // populate the view
    elem.innerHTML = this.view();

    // Label the card by title (for screen reader).
    elem.setAttribute('aria-labelledby', this.titleId);
    // define role group for the card (for screen reader).
    elem.setAttribute('role', 'group');
    // Indicate security state where applicable & available
    if (this.sslState) {
      elem.dataset.ssl = this.sslState;
    }
    elem.setAttribute('aria-labelledby', this.titleId);

    this.viewClassList.forEach(function(cls) {
      elem.classList.add(cls);
    });

    if (this.containerElement) {
      this.containerElement.appendChild(elem);
    }

    this._fetchElements();

    this._updateDisplay();

    this.publish('rendered');
    return elem;
  };

  /**
   * Batch apply style properties
   * @param {Object} nameValues object with style property names as keys
   *                            and values to apply to the card
   * @memberOf Card.prototype
   */
  Card.prototype.applyStyle = function(nameValues) {
    var style = this.element.style;
    for (var property in nameValues) {
      if (undefined === nameValues[property]) {
        delete style[[property]];
      } else {
        style[property] = nameValues[property];
      }
    }
  };

  /**
   * Set card's screen reader visibility.
   * @type {Boolean} A flag indicating if it should be visible to the screen
   * reader.
   * @memberOf Card.prototype
   */
  Card.prototype.setVisibleForScreenReader = function(visible) {
    this.element.setAttribute('aria-hidden', !visible);
  };

  /**
   * Call kill on the appWindow
   * @memberOf Card.prototype
   */
  Card.prototype.killApp = function() {
    this.app.kill();
  };

  /**
   * tear down and destroy the card
   * @memberOf Card.prototype
   */
  Card.prototype.destroy = function() {
    this.publish('willdestroy');
    var element = this.element;
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
    this.element = this.manager = this.app = null;
    this.publish('destroyed');
  };

  Card.prototype._updateIcon = function updateIcon(iconUrl) {
    if (!iconUrl) {
      var size = CARD_FOOTER_ICON_SIZE * window.devicePixelRatio;
      iconUrl = CardsHelper.getIconURIForApp(this.app, size);
    }
    this.iconValue = iconUrl ? 'url(' + iconUrl + ')' : '';
    // TODO: better transition options here if we use an image element
    this.iconButton.style.backgroundImage = this.iconValue;
    this.iconPending = false;
    this.iconButton.classList.remove('pending');
  };

  /**
   * Update the displayed content of a card
   * @memberOf Card.prototype
   */
  Card.prototype._updateDisplay = function c_updateDisplay() {
    var elem = this.element;
    var screenshotViews = this.screenshotViews;

    var app = this.app;
    if (app.isBrowser()) {
      elem.classList.add('browser');
    }
    if (this.iconValue) {
      this.iconButton.style.backgroundImage = this.iconValue;
    }
    if (this.iconPending) {
      this.iconButton.classList.add('pending');
    }

    var isIconPreview = !this.getScreenshotPreviewsSetting();
    if (isIconPreview) {
      elem.classList.add('appIconPreview');
    } else {
      elem.classList.remove('appIconPreview');
    }

    // get the first 3 apps
    var apps = this.group ? this.group.slice(0, 3) : [this.app];
    // we insertBefore, so last in array will be first in DOM
    apps.forEach((app, idx) => {
      var screenshotView = screenshotViews[idx];
      if (!screenshotView) {
        var refNode = elem.querySelector('.screenshotView');
        screenshotView = refNode.cloneNode(true);
        elem.insertBefore(screenshotView, refNode);
        screenshotView.style.backgroundImage = '';
      }
      screenshotView.dataset.groupindex = idx;

      if (!isIconPreview && screenshotView.style.backgroundImage) {
        console.log('Card, keeping existing backgroundImage:',
                    screenshotView.style.backgroundImage);
        return;
      }

      // Use a cached screenshot if we have one for the active app
      var cachedLayer;
      if (app.isActive()) {
        // will be null or blob url
        cachedLayer = app.requestScreenshotURL();
        screenshotView.classList.toggle('fullscreen',
                                        app.isFullScreen());
        if (app.appChrome) {
          screenshotView.classList.toggle('maximized',
                                        app.appChrome.isMaximized());
        }
      }
      screenshotView.style.backgroundImage =
        (cachedLayer ? 'url(' + cachedLayer + ')' : 'none' ) + ',' +
        '-moz-element(#' + this.app.instanceID + ')';
    });
    // tidy up extra screenshots
    screenshotViews = this.element.querySelectorAll('.screenshotView');
    for (var i = apps.length; i < screenshotViews.length; i++) {
      screenshotViews[i].parentNode.removeChild(screenshotViews[i]);
    }
  };

  Card.prototype._fetchElements = function c__fetchElements() {
    this.screenshotViews = this.element.querySelectorAll('.screenshotView');
    this.titleNode = this.element.querySelector('h1.title');
    this.iconButton = this.element.querySelector('.appIcon');
  };

  Card.prototype.getDisplayURLString = function(url) {
    // truncation/simplification of URL for card display
    var anURL;
    try {
      anURL = this.app ? new URL(url, this.app.origin) : new URL(url);
    } catch (e) {
      // return as-is if url was not valid
      return url;
    }
    var displayString = url.substring(url.indexOf(anURL.host));
    return displayString;
  };

  return (exports.Card = Card);

})(window);
