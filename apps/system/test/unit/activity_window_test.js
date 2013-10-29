'use strict';

mocha.globals(['SettingsListener', 'removeEventListener', 'addEventListener',
      'dispatchEvent', 'Applications', 'ManifestHelper',
      'ActivityWindow', 'LayoutManager', 'AttentionScreen',
      'OrientationManager', 'SettingsListener']);

mocha.globals(['AppWindow', 'BrowserMixin',
  'System', 'BrowserFrame', 'BrowserConfigHelper']);

requireApp('system/test/unit/mock_orientation_manager.js');
requireApp('system/test/unit/mock_layout_manager.js');
requireApp('system/shared/test/unit/mocks/mock_manifest_helper.js');
requireApp('system/shared/test/unit/mocks/mock_settings_listener.js');
requireApp('system/test/unit/mock_applications.js');
requireApp('system/test/unit/mock_attention_screen.js');

var mocksForActivityWindow = new MocksHelper([
  'OrientationManager', 'Applications', 'SettingsListener',
  'ManifestHelper', 'LayoutManager'
]).init();

suite('system/ActivityWindow', function() {
  mocksForActivityWindow.attachTestHelpers();
  var activityWindow;
  var clock, stubById;
  var fakeConfig = {
    'url': 'app://fakeact.gaiamobile.org/pick.html',
    'oop': true,
    'name': 'Fake Activity',
    'manifestURL': 'app://fakeact.gaiamobile.org/manifest.webapp',
    'origin': 'app://fakeact.gaiamobile.org',
    'manifest': {
      'name': 'Fake Activity'
    }
  };

  setup(function(done) {
    clock = sinon.useFakeTimers();

    stubById = this.sinon.stub(document, 'getElementById');
    stubById.returns(document.createElement('div'));
    requireApp('system/js/system.js');
    requireApp('system/js/browser_config_helper.js');
    requireApp('system/js/browser_frame.js');
    requireApp('system/js/window.js');
    requireApp('system/js/brower_mixin.js');
    requireApp('system/js/activity_window.js', done);
  });

  teardown(function() {
    clock.restore();
    stubById.restore();
  });

  suite('activity window instance.', function() {
    var app;
    setup(function() {
      app = new AppWindow({
        iframe: document.createElement('iframe'),
        frame: document.createElement('div'),
        origin: 'http://fake',
        url: 'http://fakeurl/index.html',
        manifestURL: 'http://fakemanifesturl',
        name: 'fake',
        manifest: {
          orientation: 'default'
        }
      });
    });
    teardown(function() {
    });
    test('Activity created', function() {
      var created = false;
      window.addEventListener('activitycreated', function oncreated() {
        window.removeEventListener('activitycreated', oncreated);
        created = true;
      });
      activityWindow = new ActivityWindow(fakeConfig);
      assert.equal(
        activityWindow.browser.element.getAttribute('mozbrowser'),
        'true');
      assert.isTrue(created);
    });

    test('Activity resize chain', function() {
      var activity = new ActivityWindow(fakeConfig, app);
      var activity2 = new ActivityWindow(fakeConfig, activity);
      var stubResize2 = this.sinon.stub(activity2, 'resize');
      app.resize();
      assert.isTrue(stubResize2.called);
      stubResize2.restore();
    });

    test('Activity orientate chain', function() {
      var activity = new ActivityWindow(fakeConfig, app);
      var activity2 = new ActivityWindow(fakeConfig, activity);
      var stubSetOrientation2 = this.sinon.stub(activity2, 'setOrientation');
      app.setOrientation();
      assert.isTrue(stubSetOrientation2.called);
      stubSetOrientation2.restore();
    });
  });
});
