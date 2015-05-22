'use strict';
/* global
  PinCard,
  PlacesIdbStore,
  SyncDataStore */

(function(exports) {

  var STORE_NAME = 'places';
  var MAX_RESULTS = 20;
  var container = document.getElementById('pages-container');

  function Places() {}

  Places.prototype = {

    init: function() {
      console.log('init called');
      this.persistStore = new PlacesIdbStore();

      console.log('calling persistStore.init');
      this.persistStore.init().then(() => {
        console.log('inside persistStore.init');
        this.syncStore =
          new SyncDataStore(STORE_NAME, this.persistStore, 'url');
        console.log('got a sync datastore');

        this.syncStore.filter = function(place) {
          return place.url.startsWith('app://') ||
            place.url === 'about:blank';
        };
        this.syncStore.onChange = function() {
          showPages();
        };
        // Make init return a promise, so we know when
        // we did the sync. Used right now for testing
        // porpoises.
        var rev = this.persistStore.latestRevision || 0;
        console.log('got the rev', rev);
        return this.syncStore.sync(rev).then(() => {
          console.log('got the sync');
          return new Promise(resolve => {
            showPages();
            resolve();
          });
        }, err => {
          console.log('Got rejection', err);
        });
      });
    }
  };

  function isPinned(place) {
    if (place.pinned) {
      return true;
    } else {
      return false;
    }
  }

  function showPages() {
    console.log('Showing pages.');
    var store = places.persistStore;

    store.read('pinTime', MAX_RESULTS, function(results) {
      var docFragment = document.createDocumentFragment();
      results.forEach(function(x) {
        var card = new PinCard(x);
        docFragment.appendChild(card.element);
        card.element.onclick = function launch(data) {
          if (!data.url) {
            return;
          }

          var features = {
            name: data.title ? data.title : '',
            remote: true
          };

          if (this.element.dataset.iconUrl) {
            features.icon = this.element.dataset.iconUrl;
          }

          window.open(data.url, '_blank', Object.keys(features)
            .map(function eachFeature(key) {
            return encodeURIComponent(key) + '=' +
              encodeURIComponent(features[key]);
          }).join(','));
        }.bind(card, x);
      });
      container.innerHTML = '';
      container.appendChild(docFragment);
    }, isPinned);
  }

  var places = new Places();
  places.init();

}(window));
