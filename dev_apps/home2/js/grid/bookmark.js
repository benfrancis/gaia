'use strict';
/* global GridItem */
/* global MozActivity */
/* jshint nonew: false */

(function(exports) {

  /**
   * Represents a single bookmark icon on the homepage.
   */
  function Bookmark(record) {
    this.detail = record;
    this.detail.type = 'bookmark';
  }

  Bookmark.prototype = {

    __proto__: GridItem.prototype,

    /**
     * Returns the height in pixels of each icon.
     */
    get pixelHeight() {
      return app.zoom.gridItemHeight;
    },

    /**
     * Width in grid units for each icon.
     */
    gridWidth: 1,

    get name() {
      return this.detail.name;
    },

    get icon() {
      return this.detail.icon;
    },

    get identifier() {
      return this.detail.id;
    },

    /**
     * Bookmarks are always editable.
     */
    isEditable: function() {
      return true;
    },

    /**
     * Bookmarks are always removable unless specified in this.detail.
     */
    isRemovable: function() {
      if (this.detail.removable === false) {
        return false;
      }
      return true;
    },

    /**
     * Launches the bookmark in a browser window.
     */
    launch: function() {
      var features = {
        name: this.name,
        icon: this.icon,
        remote: true,
        useAsyncPanZoom: true,
        features: this.detail.features
      };

      window.open(this.detail.url, '_blank', Object.keys(features)
        .map(function eachFeature(key) {
        return encodeURIComponent(key) + '=' +
          encodeURIComponent(features[key]);
      }).join(','));
    },

    /**
     * Opens a web activity to remove the bookmark.
     */
    remove: function() {
      new MozActivity({
        name: 'remove-bookmark',
        data: {
          type: 'url',
          url: this.detail.id
        }
      });
    }
  };

  exports.Bookmark = Bookmark;

}(window));
