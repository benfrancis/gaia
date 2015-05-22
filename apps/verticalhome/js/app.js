'use strict';
/* global ItemStore, LazyLoader, Configurator, groupEditor */
/* global requestAnimationFrame */

(function(exports) {

  // Hidden manifest roles that we do not show
  const HIDDEN_ROLES = [
    'system', 'input', 'homescreen', 'theme', 'addon', 'langpack'
  ];

  const EDIT_MODE_TRANSITION_STYLE =
    'transform 0.25s ease 0s, height 0s ease 0.5s';

  const DRAG_THRESHOLD = window.devicePixelRatio * 5;
  const DRAG_DEFAULT_ANIMATION_TIME = 0.2;
  const DRAG_MINIMUM_ANIMATION_TIME = 0.05;
  const DRAG_MAXIMUM_EVENT_AGE = 50;

  function App() {
    window.performance.mark('navigationLoaded');
    this.grid = document.getElementById('icons');
    this.pages = document.getElementById('pages-container');
    this.pageIndicator = document.getElementById('page-indicator');
    this.pagesVisible = false;

    this.grid.addEventListener('transitionend', this);
    this.pages.addEventListener('transitionend', this);

    this.grid.addEventListener('iconblobdecorated', this);
    this.grid.addEventListener('gaiagrid-iconbloberror', this);
    this.grid.addEventListener('gaiagrid-attention', this);
    this.grid.addEventListener('gaiagrid-resize', this);
    this.grid.addEventListener('cached-icons-rendered', this);
    this.grid.addEventListener('edititem', this);
    this.grid.addEventListener('editmode-start', this);
    this.grid.addEventListener('editmode-end', this);
    window.addEventListener('hashchange', this);
    window.addEventListener('gaiagrid-saveitems', this);
    window.addEventListener('online', this.retryFailedIcons.bind(this));

    var editModeDone = document.getElementById('exit-edit-mode');
    editModeDone.addEventListener('click', this.exitEditMode);

    window.addEventListener('gaiagrid-dragdrop-begin', this);
    window.addEventListener('gaiagrid-dragdrop-finish', this);

    window.addEventListener('context-menu-open', this);
    window.addEventListener('context-menu-close', this);

    window.addEventListener('gaia-confirm-open', this);
    window.addEventListener('gaia-confirm-close', this);

    this.layoutReady = false;
    window.addEventListener('gaiagrid-layout-ready', this);

    // some terrible glue to keep track of which icons failed to download
    // and should be retried when/if we come online again.
    this._iconsToRetry = [];

    document.addEventListener('visibilitychange', this);

    window.performance.mark('navigationInteractive');
  }

  App.prototype = {

    HIDDEN_ROLES: HIDDEN_ROLES,
    EDIT_MODE_TRANSITION_STYLE: EDIT_MODE_TRANSITION_STYLE,

    /**
     * Showing the correct icon is ideal but sometimes not possible if the
     * network is down (or some other random reason we could not fetch at the
     * time of installing the icon on the homescreen) so this function handles
     * triggering the retries of those icon displays.
     */
    retryFailedIcons: function() {
      if (!this._iconsToRetry.length) {
        return;
      }

      var icons = this.grid.getIcons();
      var iconId;

      // shift off items so we don't rerun them if we go online/offline quicky.
      while ((iconId = this._iconsToRetry.shift())) {
        var icon = icons[iconId];
        // icons may be removed so just continue on if they are now missing
        if (!icon) {
          continue;
        }

        // attempt to re-render the icon which also fetches it. If this fails it
        // will trigger another failure event and eventually end up here again.
        icon.renderIcon();
      }
    },

    /**
     * Fetch all icons and render them.
     */
    init: function() {
      this.itemStore = new ItemStore((firstTime) => {
        if (!firstTime) {
          return;
        }

        LazyLoader.load(['shared/js/icc_helper.js',
                         'shared/js/version_helper.js',
                         'js/configurator.js'], function onLoad() {
          exports.configurator = new Configurator();
        });
      });

      this.itemStore.all(function _all(results) {
        results.forEach(function _eachResult(result) {
          this.grid.add(result);
        }, this);

        if (this.layoutReady) {
          this.renderGrid();
        } else {
          window.addEventListener('gaiagrid-layout-ready', function onReady() {
            window.removeEventListener('gaiagrid-layout-ready', onReady);
            this.renderGrid();
          }.bind(this));
        }

        window.performance.mark('visuallyLoaded');
        window.performance.mark('contentInteractive');

        window.addEventListener('localized', this.onLocalized.bind(this));
        LazyLoader.load(['shared/elements/gaia-header/dist/gaia-header.js',
                         'js/contextmenu_handler.js',
                         '/shared/js/homescreens/confirm_dialog_helper.js'],
          function() {
            window.performance.mark('fullyLoaded');
          });
      }.bind(this));

      this.inDrag = false;
      this.dragStartPosition = { x: 0, y: 0 };
      this.dragLastPosition = { x: 0, y: 0 };
      this.dragLastMove = { dx: 0, delta: 0, time: 0 };
      this.dragOffset = 0;
      this.startDragListeners();
    },

    renderGrid: function() {
      this.grid.setEditHeaderElement(document.getElementById('edit-header'));
      this.grid.render();
    },

    start: function() {
      this.grid.start();
    },

    stop: function() {
      this.grid.stop();
    },

    /**
     * Called whenever the page is localized after the first render.
     * Localizes all of the items.
     */
    onLocalized: function() {
      var items = this.grid.getItems();
      items.forEach(function eachItem(item) {
        if(!item.name) {
          return;
        }

        item.updateTitle();
      });
      this.renderGrid();
    },

    /**
     * Called when we press 'Done' to exit edit mode.
     * Fires a custom event to use the same path as pressing the home button.
     */
    exitEditMode: function(e) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('hashchange'));
    },

    startDragListeners: function() {
      document.body.addEventListener('touchstart', this);
      document.body.addEventListener('touchend', this);
      document.body.addEventListener('touchcancel', this);
    },

    stopDragListeners: function() {
      if (this.inDrag) {
        this.stopDrag();
      }

      document.body.removeEventListener('touchstart', this);
      document.body.removeEventListener('touchend', this);
      document.body.removeEventListener('touchcancel', this);
    },

    updateDrag: function(e) {
      var [pageX, pageY] = e.touches.length ?
        [e.touches[0].pageX, e.touches[0].pageY] : [e.pageX, e.pageY];

      var lastMove = pageX - this.dragLastPosition.x;
      if (Math.abs(lastMove) !== 0) {
        this.dragLastMove.dx = lastMove;
        this.dragLastMove.delta = e.timeStamp - this.dragLastMove.time;
        this.dragLastMove.time = e.timeStamp;
      }

      this.dragLastPosition.x = pageX;
      this.dragLastPosition.y = pageY;

      if (this.inDrag) {
        e.preventDefault();

        var width = window.innerWidth;
        this.dragOffset = Math.min(0,
          Math.max(-width, (this.pagesVisible ? -width : 0) +
                           this.dragLastPosition.x - this.dragStartPosition.x));
        this.grid.style.transform = this.pages.style.transform =
          'translateX(' + this.dragOffset + 'px)';
      }
    },

    stopDrag: function(e) {
      document.body.classList.remove('dragging');
      document.body.removeEventListener('touchmove', this);

      if ((this.pagesVisible && this.dragOffset === -width) ||
          (!this.pagesVisible && this.dragOffset === 0)) {
        this.inDrag = false;
        return;
      }

      document.body.classList.add('was-dragging');
      var width = window.innerWidth;
      var animationTime = DRAG_DEFAULT_ANIMATION_TIME;
      var direction = (this.dragOffset <= -width / 2) ? 1 : 0;
      if (this.inDrag && e) {
        if (e.timeStamp - this.dragLastMove.time <= DRAG_MAXIMUM_EVENT_AGE) {
          var velocity = (this.dragLastMove.delta / 1000) /
            this.dragLastMove.dx;
          animationTime = Math.min(DRAG_DEFAULT_ANIMATION_TIME,
            Math.max(DRAG_MINIMUM_ANIMATION_TIME,
              Math.abs(velocity) * width));
          if (animationTime < DRAG_DEFAULT_ANIMATION_TIME) {
            direction = velocity >= 0 ? 0 : 1;
          }
        }
      }

      this.pagesVisible = (direction === 1);
      this.pageIndicator.children[direction].classList.add('active');
      this.pageIndicator.children[1 - direction].classList.remove('active');
      console.log('Pages visible = ' + this.pagesVisible);

      this.inDrag = false;
      this.grid.style.transitionDuration =
        this.pages.style.transitionDuration = animationTime + 's';
      this.grid.style.transform = this.pages.style.transform =
        'translateX(' + (width * -direction) + 'px)';
    },

    /**
     * General event handler.
     */
    handleEvent: function(e) {
      switch(e.type) {
        // Expose the cached-icons-rendered to the window. This makes it so
        // we don't have to couple the item store and the app object.
        case 'cached-icons-rendered':
          window.dispatchEvent(
            new CustomEvent('gaiagrid-cached-icons-rendered'));
          break;

        case 'iconblobdecorated':
          var item = e.detail;

          // XXX: sad naming... e.detail is a gaia grid GridItem interface.
          this.itemStore.saveItem(item.detail, () => {
            // test prefix to indicate this is used for testing only.
            item.element.classList.add('test-icon-cached');
          });
          break;

        case 'edititem':
          var icon = e.detail;
          if (icon.detail.type != 'divider') {
            // We only edit groups
            return;
          }

          LazyLoader.load('js/edit_group.js', () => {
            groupEditor.edit(icon);
          });
          break;

        case 'gaiagrid-iconbloberror':
          // Attempt to redownload this icon at some point in the future
          this._iconsToRetry.push(e.detail.identifier);
          break;

        case 'gaiagrid-attention':
          var offsetTop = this.grid.offsetTop;
          var scrollTop = window.scrollY;
          var gridHeight = document.body.clientHeight;

          // In edit mode, the grid is obscured by the edit header, whose
          // size matches the offsetTop of the grid.
          if (this.grid._grid.dragdrop.inEditMode) {
            gridHeight -= offsetTop;
          } else {
            scrollTop -= offsetTop;
          }

          // Try to nudge scroll position to contain the item.
          var rect = e.detail;
          if (scrollTop + gridHeight < rect.y + rect.height) {
            scrollTop = (rect.y + rect.height) - gridHeight;
          }
          if (scrollTop > rect.y) {
            scrollTop = rect.y;
          }

          if (!this.grid._grid.dragdrop.inEditMode) {
            scrollTop += offsetTop;
          }

          if (scrollTop !== window.scrollY) {
            // Grid hides overflow during dragging and normally only unhides it
            // when it finishes. However, this causes smooth scrolling not to
            // work, so remove it early.
            document.body.style.overflow = '';

            // We need to make sure that this smooth scroll happens after
            // a style flush, and also after the container does any
            // size-changing, otherwise it will stop the in-progress scroll.
            // We do this using a nested requestAnimationFrame.
            requestAnimationFrame(() => { requestAnimationFrame(() => {
              window.scrollTo({ left: 0, top: scrollTop, behavior: 'smooth'});
            });});
          }
          break;

        case 'gaiagrid-resize':
          var height = e.detail;
          var oldHeight = this.grid.clientHeight;

          if (this.gridResizeTimeout !== null) {
            clearTimeout(this.gridResizeTimeout);
            this.gridResizeTimeout = null;
          }

          if (height < oldHeight) {
            // Make sure that if we're going to shrink the grid so that exposed
            // area is made inaccessible, we scroll it out of view first.
            var viewHeight = document.body.clientHeight;
            var scrollBottom = window.scrollY + viewHeight;
            var padding = window.getComputedStyle ?
              parseInt(window.getComputedStyle(this.grid).paddingBottom) : 0;
            var maxScrollBottom = height + this.grid.offsetTop + padding;

            if (scrollBottom >= maxScrollBottom) {
              // This scrollTo needs to happen after the height style
              // change has been processed, or it will be overridden.
              // Ensure this by wrapping it in a nested requestAnimationFrame.
              requestAnimationFrame(() => { requestAnimationFrame(() => {
                window.scrollTo({ left: 0, top: maxScrollBottom - viewHeight,
                                  behavior: 'smooth' });
              });});
            }
          }

          if (height === oldHeight) {
            break;
          }

          // Although the height is set immediately, a CSS transition rule
          // means it's actually delayed by 0.5s, giving any scrolling
          // animations time to finish.
          this.grid.style.height = height + 'px';
          break;

        case 'gaiagrid-saveitems':
          this.itemStore.save(this.grid.getItems());
          break;

        case 'context-menu-open':
        case 'gaia-confirm-open':
          document.body.classList.add('fixed-overlay-shown');
          /* falls through */
        case 'gaiagrid-dragdrop-begin':
          // Home button disabled while dragging or the contexmenu is displayed
          window.removeEventListener('hashchange', this);
          break;

        case 'context-menu-close':
        case 'gaia-confirm-close':
          document.body.classList.remove('fixed-overlay-shown');
          /* falls through */
        case 'gaiagrid-dragdrop-finish':
          window.addEventListener('hashchange', this);
          break;

        case 'gaiagrid-layout-ready':
          this.layoutReady = true;
          window.removeEventListener('gaiagrid-layout-ready', this);
          break;

        case 'visibilitychange':
          // Stop displayport rendering for a faster first paint after
          // a setVisible(false)/setVisible(true) cycle.
          if (document.hidden) {
            document.body.style.overflow = 'hidden';
          } else {
            setTimeout(function() {
              document.body.style.overflow = '';
            });
          }
          break;

        case 'editmode-start':
          // The below property in verticalhome's stylesheet is
          // always overriden by a scoped style.
          // Only inline-style can get higher specificity than a scoped style,
          // so the property is written as inline way.
          //
          // 'transform 0.25s' is from the original property in gaia-grid.
          // ( shared/elements/gaia_grid/style.css )
          //
          // 'height 0s 0.5s' is to apply collapsing animation in edit mode.
          this.grid.style.transition = this.EDIT_MODE_TRANSITION_STYLE;

          this.stopDragListeners();
          break;

        case 'editmode-end':
          // Retore the blank transtion property back.
          this.grid.style.transition = '';

          this.startDragListeners();
          break;

        // A hashchange event means that the home button was pressed.
        // The system app changes the hash of the homescreen iframe when it
        // receives a home button press.
        case 'hashchange':
          // The group editor UI will be hidden by itself so returning...
          var editor = exports.groupEditor;
          if (editor && !editor.hidden) {
            return;
          }

          var _grid = this.grid._grid;

          // Leave edit mode if the user is in edit mode.
          // We do not lazy load dragdrop until after load, so the user can not
          // take this path until libraries are loaded.
          if (_grid.dragdrop && _grid.dragdrop.inEditMode) {
            _grid.dragdrop.exitEditMode();
            return;
          }

          // Bug 1021518 - ignore home button taps on lockscreen
          if (document.hidden) {
            return;
          }

          window.scrollTo({left: 0, top: 0, behavior: 'smooth'});
          break;

        case 'transitionend' :
          if (e.target === this.grid || e.target === this.pages) {
            e.target.style.transition = '';
            document.body.classList.remove('was-dragging');
          }
          break;

        case 'touchstart':
          if (this.inDrag) {
            this.stopDrag();
            break;
          }

          this.dragLastPosition.x = this.dragStartPosition.x =
            e.touches[0].pageX;
          this.dragLastPosition.y = this.dragStartPosition.y =
            e.touches[0].pageY;
          this.dragLastMove.dx = this.dragLastMove.delta = 0;
          this.dragLastMove.time = e.timeStamp;
          this.dragOffset = this.pagesVisible ? -window.innerWidth : 0;

          document.body.addEventListener('touchmove', this);
          break;

        case 'touchmove':
          this.updateDrag(e);

          if (!this.inDrag) {
            var dx = e.touches[0].pageX - this.dragStartPosition.x;
            var dy = e.touches[0].pageY - this.dragStartPosition.y;

            if (Math.abs(dy) > DRAG_THRESHOLD) {
              document.body.removeEventListener('touchmove', this);
            } else if (Math.abs(dx) > DRAG_THRESHOLD) {
              this.inDrag = true;
              document.body.classList.add('dragging');
            }
          }
          break;

        case 'touchcancel':
        case 'touchend':
          this.stopDrag(e);
          break;
      }
    }
  };

  // Dummy configurator
  exports.configurator = {
    getSingleVariantApp: function() {
      return {};
    },
    get isSingleVariantReady() {
      return true;
    },
    get isSimPresentOnFirstBoot() {
      return false;
    },
    getItems: function(role) {
      return {};
    }
  };
  exports.app = new App();
  exports.app.init();

}(window));
