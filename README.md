# mz-deploy-http-push

基于 fis-deploy-http-push 插件修改：

* `to`、`receiver` 参数支持 function 传入
* 增加 `params` 参数传递给后端 receiver 接口，同时可在 `to` function 中动态修改 params 配置


##示例

```javascript

fis.media('prod')
  .match('*', {
    deploy: [fis.plugin('local-deliver', {
      to: '../../dist'
    }),fis.plugin('http-push', {
      receiver: 'http://www.example.com/receiver.php',
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