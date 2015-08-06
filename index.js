
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

  var subpath = file.subpath;
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

module.exports = function(options, modified, total, callback) {
  if (!options.to) {
    throw new Error('options.to is required!');
  } else if (!options.receiver) {
    throw new Error('options.receiver is required!');
  }

  var to = options.to;
  var receiver = options.receiver;
  var params = options.params || {};

  var steps = [];

  modified.forEach(function(file) {
    var reTryCount = options.retry;

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
