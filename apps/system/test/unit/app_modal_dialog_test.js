'use strict';

mocha.globals(['AppWindow', 'AppModalDialog', 'System', 'BaseUI']);


requireApp('system/test/unit/mock_l10n.js');
requireApp('system/test/unit/mock_orientation_manager.js');
requireApp('system/test/unit/mock_app_window.js');

var mocksForAppModalDialog = new MocksHelper([
  'AppWindow'
]).init();

suite('system/AppModalDialog', function() {
  var clock, stubById, realL10n;
  mocksForAppModalDialog.attachTestHelpers();
  setup(function(done) {
    realL10n = navigator.mozL10n;
    navigator.mozL10n = MockL10n;
    clock = sinon.useFakeTimers();

    stubById = this.sinon.stub(document, 'getElementById');
    stubById.returns(document.createElement('div'));
    requireApp('system/js/system.js');
    requireApp('system/js/base_ui.js');
    requireApp('system/js/app_modal_dialog.js', done);
  });

  teardown(function() {
    navigator.mozL10n = realL10n;
    clock.restore();
    stubById.restore();
  });

  var fakeAppConfig1 = {
    url: 'app://www.fake/index.html',
    manifest: {},
    manifestURL: 'app://wwww.fake/ManifestURL',
    origin: 'app://www.fake'
  };

  var fakeAlertEvent = {
    type: 'mozbrowsermodalprompt',
    preventDefault: function() {},
    detail: {
      type: 'alert',
      unblock: function() {}
    }
  };

  var fakeConfirmEvent = {
    type: 'mozbrowsermodalprompt',
    preventDefault: function() {},
    detail: {
      type: 'confirm',
      unblock: function() {}
    }
  };

  var fakePromptEvent = {
    type: 'mozbrowsermodalprompt',
    preventDefault: function() {},
    detail: {
      type: 'prompt',
      unblock: function() {}
    }
  };

  var toCamelCase = function toCamelCase(str) {
    return str.replace(/\-(.)/g, function replacer(str, p1) {
      return p1.toUpperCase();
    });
  };

  function renderFakeElements(md) {
    md.element = document.createElement('div');
    AppModalDialog.elementClasses.forEach(function createElementRef(name) {
      md.elements[toCamelCase(name)] = document.createElement('div');
    });
  };

  test('New', function() {
    var app1 = new AppWindow(fakeAppConfig1);
    var md1 = new AppModalDialog(app1);
    assert.isDefined(md1.instanceID);
  });

  test('Alert', function() {
    var app1 = new AppWindow(fakeAppConfig1);
    var md1 = new AppModalDialog(app1);
    renderFakeElements(md1);
    md1.events.push(fakeAlertEvent);
    md1.show();
  });

  test('Confirm', function() {
    var app1 = new AppWindow(fakeAppConfig1);
    var md1 = new AppModalDialog(app1);
    renderFakeElements(md1);
    md1.events.push(fakeConfirmEvent);
    md1.show();
  });

  test('Prompt', function() {
    var app1 = new AppWindow(fakeAppConfig1);
    var md1 = new AppModalDialog(app1);
    renderFakeElements(md1);
    md1.events.push(fakePromptEvent);
    md1.show();
  });

});
