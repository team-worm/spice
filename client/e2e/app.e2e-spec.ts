import { browser, element, by } from 'protractor';

describe('E2E Tests', function () {

  beforeEach(function () {
    browser.get('');
  });

  it('application loaded', function () {
    expect(element(by.tagName('spice-root'))).toBeDefined();
  });

});
