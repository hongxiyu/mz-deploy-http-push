
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

function isFileChanged(options,file){
    var fileLocalPath = _(options.toLocal,file.getHashRelease());

    //文件是否存在
    if(_.isFile(fileLocalPath)){
        //如果是静态资源，因为已经发布过 CDN 所以无需重新发布
        if(file.useHash){
            return false;
        //如果是非静态资源，看内容是否相同
        }else{
            if(_.md5(_.read(fileLocalPath)) ===  file.getHash()){
                return false;
            }else{
                return true;
            }  
        }
    }else{
        return true;
    }
}

module.exports = function(options, modified, total, callback) {
  var _ = fis.util, 
      publist = [],
      isAutoPublist = false,
      //目录不存在，初始化的时候，避免自动模式上传所有文件
      hasLocalDistDir = _.isDir(options.toLocal),
      publistFilePath = path.join(fis.project.getProjectPath(),options.publist),
      publistResult = [];

  if(_.isFile(publistFilePath)){
    publist = _.read(publistFilePath).toString().replace(/^#.*$/gm,'').trim();
    if(publist.length){
        publist = publist.split(/\s+/);
    }else{
        isAutoPublist = !! options.toLocal;
    }
  }

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
    
    if(!options.publist || isMatchList(publist, file.subpath) || (isAutoPublist && hasLocalDistDir && isFileChanged(options,file))){
        publistResult.push(file.subpath);
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
    //最后写 local
    if(options.toLocal){
        _.write(_(options.toLocal,file.getHashRelease()), file.getContent());        
    }
  });

  _.reduceRight(steps, function(next, current) {
    return function() {
      current(next);
    };
  }, callback)();
  
  //将发布列表写回 publist，用于发布 prod 或参考
  if(isAutoPublist && publistResult.length){
      var publistFileContent = _.read(publistFilePath).toString();
      var publistResultTxt = publistResult.reduce(function(previousValue, currentValue, index, array){
            return previousValue + '\n# ' + currentValue;
          },'\n#\n# ====== ' + new Date().toLocaleString() + ' ======\n#');
      _.write(publistFilePath, publistFileContent + publistResultTxt);
  }
};

module.exports.options = {
  retry: 2
};
