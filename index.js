/* jshint node: true */
'use strict';

var BasePlugin = require('ember-cli-deploy-plugin'),
    OSS = require('./lib/oss'),
    Promise = require('ember-cli/lib/ext/promise'),
    minimatch = require('minimatch');

module.exports = {
  name: 'ember-cli-deploy-oss',

  createDeployPlugin: function(options) {

    var DeployPlugin = BasePlugin.extend({
      name: options.name,
      defaultConfig: {
        filePattern: '**/*.{html,js,css,png,gif,ico,jpg,map,xml,txt,svg,swf,eot,ttf,woff,woff2,json}',
        prefix: '',
        acl: 'public-read',
        distDir: function(context) {
          return context.distDir;
        },
        distFiles: function(context) {
          return context.distFiles || [];
        },
        gzippedFiles: function(context) {
          return context.gzippedFiles || []; // e.g. from ember-cli-deploy-gzip
        },
        manifestPath: function(context) {
          return context.manifestPath; // e.g. from ember-cli-deploy-manifest
        },
        uploadClient: function(context) {
          return context.uploadClient; // if you want to provide your own upload client to be used instead of one from this addon
        },
        ossClient: function(context) {
          return context.ossClient; // if you want to provide your own Aliyun OSS client to be used instead of one from aliyun-sdk
        }
      },
      requiredConfig: ['accessKeyId', 'secretAccessKey', 'bucket', 'region'],

      upload: function(context) {
        var self = this,
            filePattern = this.readConfig('filePattern'),
            distDir = this.readConfig('distDir'),
            distFiles = this.readConfig('distFiles'),
            gzippedFiles = this.readConfig('gzippedFiles'),
            bucket = this.readConfig('bucket'),
            acl = this.readConfig('acl'),
            prefix = this.readConfig('prefix'),
            manifestPath = this.readConfig('manifestPath'),
            filesToUpload = distFiles.filter(minimatch.filter(filePattern, { matchBase: true })),
            oss = this.readConfig('uploadClient') || new OSS({ plugin: this }),
            options = {
              cwd: distDir,
              filePaths: filesToUpload,
              gzippedFilePaths: gzippedFiles,
              prefix: prefix,
              bucket: bucket,
              acl: acl,
              manifestPath: manifestPath
            };

        this.log('preparing to upload to OSS bucket `' + bucket + '`', { verbose: true });

        return oss.upload(options)
          .then(function(filesUploaded){
            self.log('uploaded ' + filesUploaded.length + ' files ok', { verbose: true });
            return { filesUploaded: filesUploaded };
          })
          .catch(this._errorMessage.bind(this));
      },

      _errorMessage: function(error) {
        this.log(error, { color: 'red' });
        if (error) {
          this.log(error.stack, { color: 'red' });
        }
        return Promise.reject(error);
      }
    });

    return new DeployPlugin();
  }
};
