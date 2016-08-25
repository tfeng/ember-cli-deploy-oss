var CoreObject = require('core-object'),
    OSS = require('aliyun-sdk').OSS,
    Promise = require('ember-cli/lib/ext/promise'),
    fs = require('fs'),
    mime = require('mime-types'),
    path = require('path'),
    _ = require('lodash');

module.exports = CoreObject.extend({
  init: function(options) {
    this._super();
    this._plugin = options.plugin;
    this._client = this._plugin.readConfig('ossClient') || new OSS({
      accessKeyId: this._plugin.readConfig('accessKeyId'),
      secretAccessKey: this._plugin.readConfig('secretAccessKey'),
      endpoint: "http://" + this._plugin.readConfig('region') + '.aliyuncs.com',
      apiVersion: "2013-10-15"
    });
  },

  upload: function(options) {
    options = options || {};
    return this._determineFilePaths(options).then(function(filePaths){
      return Promise.all(this._putObjects(filePaths, options));
    }.bind(this));
  },

  _determineFilePaths: function(options) {
    var plugin = this._plugin,
        filePaths = options.filePaths || [];
    if (typeof filePaths === 'string') {
      filePaths = [filePaths];
    }
    var prefix = options.prefix,
        manifestPath = options.manifestPath;
    if (manifestPath) {
      var key = path.join(prefix, manifestPath);
      plugin.log('Downloading manifest for differential deploy from `' + key + '`...', { verbose: true });
      return new Promise(function(resolve, reject){
        var params = { Bucket: options.bucket, Key: key};
        this._client.getObject(params, function(error, data) {
          if (error) {
            reject(error);
          } else {
            resolve(data.Body.toString().split('\n'));
          }
        }.bind(this));
      }.bind(this)).then(function(manifestEntries){
        plugin.log("Manifest found. Differential deploy will be applied.", { verbose: true });
        return _.difference(filePaths, manifestEntries);
      }).catch(function(/* reason */){
        plugin.log("Manifest not found. Disabling differential deploy.", { color: 'yellow', verbose: true });
        return Promise.resolve(filePaths);
      });
    } else {
      return Promise.resolve(filePaths);
    }
  },

  _putObjects: function(filePaths, options) {
    var plugin = this._plugin,
        cwd = options.cwd,
        bucket = options.bucket,
        prefix = options.prefix,
        acl = options.acl,
        gzippedFilePaths = options.gzippedFilePaths || [],
        cacheControl = options.cacheControl || 'no-cache, no-store, must-revalidate',
        expires = options.expires,
        manifestPath = options.manifestPath,
        pathsToUpload = filePaths;

    if (manifestPath) {
      pathsToUpload.push(manifestPath);
    }

    return pathsToUpload.map(function(filePath) {
      var basePath = path.join(cwd, filePath),
          data = fs.readFileSync(basePath),
          contentType = mime.lookup(basePath),
          encoding = mime.charsets.lookup(contentType),
          key = path.join(prefix, filePath),
          isGzipped = gzippedFilePaths.indexOf(filePath) !== -1;

      if (encoding) {
        contentType += '; charset=' + encoding.toLowerCase();
      }

      var params = {
        Bucket: bucket,
        ACL: acl,
        Body: data,
        ContentType: contentType,
        Key: key,
        CacheControl: cacheControl,
        Expires: expires
      };
      if (isGzipped) {
        params.ContentEncoding = 'gzip';
      }

      return new Promise(function(resolve, reject) {
        this._client.putObject(params, function(error, data) {
          if (error) {
            reject(error);
          } else {
            plugin.log('✔  ' + key, { verbose: true });
            resolve(filePath);
          }
        });
      }.bind(this));
    }.bind(this));
  }
});
