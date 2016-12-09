/* eslint-env node */

var _ = fis.util;
var path = require('path');
var execSync = require('child_process').execSync;


function upload(receiver, to, params, release, content, file, callback) {
  receiver = typeof receiver === 'function' ? receiver(release, file, params) : receiver;
  to = typeof to === 'function' ? to(release, file, params) : to;

  if (!to) {
    callback();
    return;
  }

  var postdata = _.merge(params, {
    to: path.join(to, release)
  });
  var subpath = file.release;
  fis.util.upload(
    //url, request options, post data, file
    receiver, null, postdata, content, subpath,
    function (err, res) {
      var time = '[' + fis.log.now(true) + ']';
      if (err || res.trim() != '0') {
        var msg = ' - '.red.bold +
          time.grey + ' ' +
          subpath.replace(/^\//, '') +
          ' [ERROR] '.red.bold +
          (err || res) +
          '\n';
        callback(msg);
      } else {
        process.stdout.write(
          ' - '.green.bold +
          time.grey + ' ' +
          subpath.replace(/^\//, '') +
          ' >> '.yellow.bold +
          path.join(to, release) +
          '\n'
        );
        callback();
      }
    }
  );
}

function isMatchList(arr, filepath) {
  for (var i = 0, len = arr.length; i < len; i++) {
    var pattern = arr[i].trim();
    if (pattern.length && fis.util.filter(filepath, pattern)) {
      return true;
    }
  }
  return false;
}

module.exports = function (options, modified, total, callback) {


  if (!options.to) {
    throw new Error('options.to is required!');
  } else if (!options.receiver) {
    throw new Error('options.receiver is required!');
  }

  var publist = [];
  var publistFilePath = path.join(fis.project.getProjectPath(), options.publist || '');
  var allFileMap = {};
  var publistResult = [];
  var errorUploadList = [];

  if (_.isFile(publistFilePath)) {
    publist = _.read(publistFilePath).toString().replace(/^(#|;).*$/gm, '').trim();
    if (publist.length) {
      publist = publist.split(/\s+/);
    }
  } else {
    publistFilePath = '';
  }

  modified.forEach(function (file) {
    var releaseFilename = file.getHashRelease();
    if (options.toLocal) {
      if (fis.util.filter(file.subpath, options.emptyFilePattern)) {
        _.write(_(options.toLocal, releaseFilename), "");
      } else {
        _.write(_(options.toLocal, releaseFilename), file.getContent());
      }
    }
    allFileMap[releaseFilename] = file;

    if (publist.length && isMatchList(publist, file.subpath)) {
      publistResult.push(releaseFilename);
    }
  });

  if (!publist.length) {
    var localDistBasename = path.basename(path.normalize(options.toLocal));
    var localDistPattern = new RegExp("^(\\.\\." + path.sep + ")*" + localDistBasename, "gm");
    var changeFileList = execSync('cd '+ options.toLocal + ' && git ls-files -mo ').toString().trim();
    publistResult = changeFileList.replace(localDistPattern, "").split(/\s+/);
  }

  var to = options.to;
  var receiver = options.receiver;
  var params = options.params || {};
  var uploadSteps = [];


  publistResult.forEach(function (releaseFilename) {
    var retryCount = options.retry;
    var file = allFileMap[releaseFilename];

    // 若发布期间有过期文件未提交版本库，会导致 publistResult 比实际要发布的内容多，所以过滤一次
    if (file) {
      uploadSteps.push(function (next) {
        var _upload = arguments.callee;
        upload(receiver, to, params, releaseFilename, file.getContent(), file, function (error) {
          if (error) {
            if (!--retryCount) {
              if(errorUploadList.length < options.maxErrorNum){
                errorUploadList.push(file.subpath);
                process.stdout.write(error);
                next();
              }else{
                throw new Error('上传出错次数过多，请检查出错原因！' + error);
              }
            } else {
              _upload(next);
            }
          } else {
            next();
          }
        });
      });
    }
  });

  // 上传是一个异步操作，所以需要这样写
  _.reduceRight(uploadSteps, function (next, current) {
    return function () {
      current(next);
    };
  }, function(){
    //将发布列表写回 publist，用于发布 prod 或参考
    if (publistFilePath && !publist.length && publistResult.length) {
      var publistFileContent = _.read(publistFilePath).toString();
      var publistResultTxt = publistResult.reduce(function (previousValue, currentValue, index) {
        return previousValue + '\n# ' + currentValue;
      }, '\n#\n# ====== ' + new Date().toLocaleString() + ' ======\n#');

      publistResultTxt = errorUploadList.reduce(function (previousValue, currentValue, index) {
        return previousValue + '\n# ' + currentValue;
      }, publistResultTxt + '\n#\n# ====== Error Upload List File ======\n#');

      _.write(publistFilePath, publistFileContent + publistResultTxt);
    }

    callback();
  })();

};

module.exports.options = {
  retry: 2,
  maxErrorNum: 10
};
