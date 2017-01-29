/*jshint esversion: 6, loopfunc: true */
var fs = require('fs');
var mkdirp = require('mkdirp');

var Pipeline = function(options) {
  this.buildDir = options.buildDir;
  this.contractsFiles = options.contractsFiles;
  this.assetFiles = options.assetFiles;
  this.logger = options.logger;
  this.plugins = options.plugins;
};

Pipeline.prototype.build = function(abi) {
  var self = this;
  for(var targetFile in this.assetFiles) {

    // TODO: run the plugin here instead, for each file

    var contentFiles = this.assetFiles[targetFile].map(file => {
      self.logger.info("reading " + file.filename);

      var pipelinePlugins = this.plugins.getPluginsFor('pipeline');

      if (file.filename === 'embark.js') {
        return {content: file.content + "\n" + abi, filename: file.filename, path: file.path, modified: true};
      } else if (file.filename === 'embark-plugins.js') {

        var filesFromPlugins = [];

        var filePlugins = self.plugins.getPluginsFor('pipelineFiles');

        if (filePlugins.length > 0) {
          filePlugins.forEach(function(plugin) {
            try {
              var fileObjects = plugin.runFilePipeline();
              for (var i=0; i < fileObjects.length; i++) {
                var fileObject = fileObjects[i];
                //console.debug(JSON.stringify(fileObject));
                filesFromPlugins.push(fileObject);
              }
            }
            catch(err) {
              self.logger.error(err.message);
            }
          });
        }

        var fileContents = filesFromPlugins.map(function(file) {
          if (pipelinePlugins.length > 0) {
            pipelinePlugins.forEach(function(plugin) {
              console.log(plugin.name + ": trying " + file.filename);
              try {
                if (file.options && file.options.skipPipeline) {
                  console.log("skipping");
                  return;
                }
                file.content = plugin.runPipeline({targetFile: file.filename, source: file.content, modified: true});
              }
              catch(err) {
                self.logger.error(err.message);
              }
            });
          }
          return file.content;
        });

        //return fileContents.join('\n');
        return {content: fileContents.join('\n'), filename: "embark-plugins.js", path: "", modified: true};

      } else if (['web3.js', 'ipfs.js', 'ipfs-api.js', 'orbit.js'].indexOf(file.filename) >= 0) {
        //return file.content;
        file.modified = true;
        return file;
      } else {

        if (pipelinePlugins.length > 0) {
          pipelinePlugins.forEach(function(plugin) {
            try {
              file.content = plugin.runPipeline({targetFile: file.filename, source: file.content});
              file.modified = true;
            }
            catch(err) {
              self.logger.error(err.message);
            }
          });
        }

        //return file.content;
        return file;
      }
    });

    var dir = targetFile.split('/').slice(0, -1).join('/');
    self.logger.info("creating dir " + this.buildDir + dir);
    mkdirp.sync(this.buildDir + dir);

    // if it's a directory
    if (targetFile.slice(-1) === '/' || targetFile.indexOf('.') === -1) {
      var targetDir = targetFile;

      if (targetDir.slice(-1) !== '/') {
        targetDir = targetDir + '/';
      }

      contentFiles.map(function(file) {
        var filename = file.filename.replace('app/', '');
        filename = filename.replace(targetDir, '');
        self.logger.info("writing file " + self.buildDir + targetDir + filename);

        fs.writeFileSync(self.buildDir + targetDir + filename, fs.readFileSync(file.filename));
      });
    } else {
      var content = contentFiles.map(function(file) {
        return file.content;
      }).join("\n");

      self.logger.info("writing file " + this.buildDir + targetFile);
      fs.writeFileSync(this.buildDir + targetFile, content);
    }
  }
};

module.exports = Pipeline;

