
var _ = fis.util, path = require('path');

function upload(receiver, to, params, release, content, file, callback) {

  var receiver  = typeof receiver === 'function' ? receiver(release, file, params) : receiver;
  var to  = typeof to === 'function' ? to(release, file, params) : to;

  //do not upload
  if(!to){
    callback();
    return;
  }

  var postdata = _.merge(params, {
    to: path.join(to,release)
  });

  var subpath = file.release;
  fis.util.upload(
    //url, request options, post data, file
    receiver, null, postdata, content, subpath,
    function(err, res) {
      // console.log(err,res);
      // return;
      if (err || res.trim() != '0') {
        callback('upload file [' + subpath + '] to [' + to +
          '] by receiver [' + receiver + '] error [' + (err || res) + ']');
      } else {
        var time = '[' + fis.log.now(true) + ']';
        process.stdout.write(
          ' - '.green.bold +
          time.grey + ' ' +
          subpath.replace(/^\//, '') +
          ' >> '.yellow.bold +
          path.join(to,release) +
          '\n'
        );
        callback();
      }
    }
  );
}


function isMatchList(arr, filepath){
  for (var i = 0, len = arr.length; i < len; i++) {
    var pattern = arr[i].trim();
    if(pattern.length && fis.util.filter(filepath, pattern)){
      return true;
    }
  }
  return false;
}

module.exports = function(options, modified, total, callback) {
  // options.publist = 'publist.txt';

  var _ = fis.util, 
      publist = [], 
      publistFilePath = path.join(fis.project.getProjectPath(),options.publist);

  if(_.isFile(publistFilePath)){
    publist = _.read(publistFilePath).split(/\s+/);
    console.log(publist);
  }
  if (!options.to) {
    throw new Error('options.to is required!');
  } else if (!options.receiver) {
    throw new Error('options.receiver is required!');
  }

  if (options.publist && publist.length === 0){
    throw new Error('publist file is empty, please make it!');
  }

  var to = options.to;
  var receiver = options.receiver;
  var params = options.params || {};

  var steps = [];

  modified.forEach(function(file) {
    var reTryCount = options.retry;
    if(!options.publist || isMatchList(publist, file.subpath)){
      steps.push(function(next) {
        var _upload = arguments.callee;

        upload(receiver, to, params, file.getHashRelease(), file.getContent(), file, function(error) {
          if (error) {
            if (!--reTryCount) {
              throw new Error(error);
            } else {
              _upload();
            }
          } else {
            next();
          }
        });
      }); 
    }
  });

  _.reduceRight(steps, function(next, current) {
    return function() {
      current(next);
    };
  }, callback)();
};

module.exports.options = {
  retry: 2
};
