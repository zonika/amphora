'use strict';
/* eslint quote-props: ["error", "as-needed", { "numbers": true }] */

const _ = require('lodash'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require('./' + filename),
  sinon = require('sinon'),
  db = require('./db'),
  bluebird = require('bluebird'),
  components = require('./components'),
  files = require('../files'),
  expect = require('chai').expect;

function returnData(ref, data) {
  return data;
}

function fakeUgrades() {
  return {
    '1.0': returnData,
    '1.1': returnData,
    '1.5': returnData,
    '2.0': returnData
  };
}

describe(_.startCase(filename), function () {
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    sandbox.stub(components);
    sandbox.stub(files);
    sandbox.stub(db);
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('generateVersionArray', function () {
    const fn = lib[this.title],
      upgrade = fakeUgrades();

    it('returns an array of versions from an object keys', function () {
      expect(fn(upgrade)).to.eql([1, 1.1, 1.5, 2]);
    });
  });

  describe('aggregateTransforms', function () {
    const fn = lib[this.title],
      upgrade = fakeUgrades();

    it('works when schema version is defined and current version is not', function () {
      expect(fn(2, undefined, upgrade)).to.eql([1, 1.1, 1.5, 2]);
    });

    it('returns only versions that are higher than its current version and less than the schema version', function () {
      expect(fn(2, 1.1, upgrade)).to.eql([1.5, 2]);
    });
  });

  describe('checkForUpgrade', function () {
    const fn = lib[this.title];

    it('calls the upgradeData function', function () {
      components.getSchema.returns(bluebird.resolve({_version: 2, value: 'foo'}));

      sandbox.stub(lib, 'upgradeData');

      return fn('site/components/foo/instances/bar', {_version: 1, value: 'bar'})
        .then(function () {
          expect(lib.upgradeData.calledOnce).to.be.true;
        });
    });
  });

  describe('upgradeData', function () {
    const fn = lib[this.title],
      sampleData = {_version: 1, value: 'bar'};

    it('does not try to run transforms if the versions are the same', function () {
      files.getComponentPath.returns('/some/path');
      files.tryRequire.returns(fakeUgrades());

      return fn(1, 1, 'site/components/foo/instances/bar', sampleData)
        .then(function () {
          expect(db.put.calledOnce).to.be.false;
        });
    });

    it('returns the data if no upgrade file exists', function () {
      files.getComponentPath.returns('/some/path');
      files.tryRequire.returns(undefined);

      return fn(1, 1, 'site/components/foo/instances/bar', sampleData)
        .then(function (resp) {
          expect(resp).to.eql(sampleData);
        });
    });

    it('runs transforms if they should be run', function () {
      files.getComponentPath.returns('/some/path');
      files.tryRequire.returns(fakeUgrades());
      db.put.returns(bluebird.resolve());

      return fn(2, 1, 'site/components/foo/instances/bar', sampleData)
        .then(function (resp) {
          expect(resp._version).to.equal(2);
        });
    });

    it('returns an error if a save fails', function () {
      files.getComponentPath.returns('/some/path');
      files.tryRequire.returns(fakeUgrades());
      db.put.returns(bluebird.reject(new Error('error msg')));

      return fn(2, 1, 'site/components/foo/instances/bar', sampleData)
        .catch(function (err) {
          expect(err.message).to.equal('error msg');
        });
    });
  });
});