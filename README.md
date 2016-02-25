# mz-deploy-http-push

基于 fis-deploy-http-push 插件修改：

* `to`、`receiver` 参数支持 function 传入
* 增加 `params` 参数传递给后端 receiver 接口，同时可在 `to` function 中动态修改 params 配置
* 增加 `toLocal` 参数，发布时写入编译后文件到指定目录，用来取代 local-deliver 插件，同时便于支持自动匹配发布模式
* 增加 `publist` 参数，根据 pulist 指向的文本文件配置需要上传的文件列表，当该文件规则为空时，启用自动匹配发布模式

## publist 文件内容示例

```
# 可以写注释，当规则为空时，则启用自动匹配发布模式，自动判断修改的文件列表并以注释形式回写至本配置文件
/*
/php-simulation-env/mock-data/**
/plugin/compiler.placeholder.php
```

## 插件调用示例

```javascript

fis.media('prod')
  .match('*', {
    deploy: [
        fis.plugin('http-push', {
        receiver: 'http://www.example.com/receiver.php',
        publist: '_publist.ini',
        toLocal: __dirname + '/../dist',
        params:{
            username: 'kaiye'  
        },
        to: function(release, file, params){
            if(fis.util.filter(release, '/static/**')){
                params.domain = 'cdn.example.com';
                return '/static';
            }else{
                params.domain = 'www.example.com';
                return '/www';
            }
        }
    })]
  });
  
```