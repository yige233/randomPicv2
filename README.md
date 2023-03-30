# randomPic | 简单的api，用于随机输出图片

## 如何使用？

1. 前往[Releases](https://github.com/yige233/randomPicv2/releases/tag/v2.0)，下载`randomPicv2ForWindows.zip`
2. 解压压缩包，找到`双击启动.cmd`，运行它。
3. 如果命令行黑框中给出了api的url链接（一般是[http://localhost:3000/info](http://localhost:3000/info)），就说明api已经启动成功。
4. 为了使api能够输出图片，还需要向刚刚程序生成的`Pics`文件夹中放入一些图片。

以上是默认情况，如果有修改config.js，情况可能会有所不同，比如程序试图使用的端口已经被占用、修改了程序使用的图片源。

Q:黑框太丑，怎么办？

A:可以把它做成服务，随电脑启动而启动，且在后台持续运行，没有黑框。

1. 前往[Releases](https://github.com/yige233/randomPicv2/releases/tag/v2.0)，下载`randomPicv2ForWindows.zip`
2. 解压压缩包，找到`安装服务.cmd`，使用管理员身份运行它。
3. 完成！
4. 如果需要卸载服务，那么找到`卸载服务.cmd`，使用管理员身份运行它。

## 一些说明

由于改的东西有一点多，新的代码几乎都是新写的，所以新开了一个repo。旧仓库在[randomPic](https://github.com/yige233/randomPic)。
- 直接访问网站不再直接提供图片，需要使用下面列出的API。
- V2对API进行了大量修改，因此不能兼容使用V1 API的程序。
- 对比V1，V2的API更加规整了，以及多了些有的没的的细节更改

### API
- 如无特殊情形，响应体的`Content-Type`均为`application/json;charset=UTF-8`
- 如无特殊情形，响应体的json结构应如下：
    ```
    {
      "code": number,
      "status": string,
      "message": string,
      "data": object || null
    }
    ```
    | 参数    | 说明                                                                       |
    | ------- | -------------------------------------------------------------------------- |
    | code    | 当次响应的http状态码                                                       |
    | status  | 当次响应的状态。存在http状态码相同，而状态不同的情况。可能的状态见下方表格 |
    | message | 人类可读的简短的响应信息。                                                 |
    | data    | 响应的具体数据                                                             |

    | 状态               | 状态码 | 说明                                   |
    | ------------------ | ------ | -------------------------------------- |
    | OK                 | 200    | OK                                     |
    | incompleteParams   | 400    | 请求中缺乏某个参数                     |
    | wrongPath          | 400    | 错误或不完整的URL路径                  |
    | pathNotFound       | 404    | 未找到指定的请求路径                   |
    | collectionNotFound | 404    | 未找到指定的收藏夹                     |
    | picNotFound        | 404    | 未找到指定的图片                       |
    | methodNotAllowed   | 405    | 不允许的http方法                       |
    | errSendingPic      | 500    | 发送图片时服务端出现错误，导致发送失败 |
    | errServerConfig    | 500    | 服务端端配置可能有误，没有可用的图片   |
    | notImplemented     | 501    | 不支持的http方法                       |


####  **地址：** `/info` 或 `/`
- **说明：** 获取API相关信息
- **方法：** `GET`
- **请求参数：** 无
- **返回示例：**
    ```
    HTTP/1.1 200 OK
    Content-Type: application/json; charset=utf-8

    {
      "code": 200,
      "status": "OK",
      "message": "OK",
      "data": {
        "version": "2.0.0",
        "doc": "https://github.com/yige233/randomPic#readme",
        "collections": [ "Default" ]
      }
    }
    ```
    | data参数      | 类型   | 说明            |
    | ------------- | ------ | --------------- |
    | version       | string | API的版本       |
    | collections   | array  | API拥有的收藏夹 |
    | collections[] | string | 收藏夹的名称    |
    | doc           | string | API的介绍文档   |


####  **地址：** `/cache`
- **说明：** 重建API缓存的图片信息
- **方法：** `DELETE`
- **请求参数：** 无
- **返回示例：**
    ```
    HTTP/1.1 204 No Content

    ```

####  **地址：** `/random-picture`
- **说明：** 获取随机图片
- **方法：** `GET`
- **请求参数：** queryString
    | 参数       | 说明                                                                                                                                         |
    | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
    | collection | 指定指定从哪个收藏夹中获得随机图片。如果要指定多个，则各个收藏夹之间用分隔符隔开；不指定则从全部收藏夹随机；若指定的收藏夹不可用则会将其过滤 |
    | 302        | 若参数存在且其值不为false，则响应将会自动跳转至随机到的图片地址                                                                              |
- **返回示例：**
    ```
    Content-Type: application/json; charset=utf-8

    {
      "code": 200,
      "status": "OK",
      "message": "OK",
      "data": {
        "pic": "418ff183.(pid-74434142)十字街口.png",
        "collection": "Default",
        "cachedAt": 1677674656,
        "size": 7427628
      }
    }
    ```
    | data参数   | 类型   | 说明                                       |
    | ---------- | ------ | ------------------------------------------ |
    | pic        | string | 图片名                                     |
    | collection | string | 图片所属的收藏夹                           |
    | cachedAt   | number | 服务器上缓存图片信息的时间                 |
    | size       | number | 图片的大小。若为-1，则说明大小未知或不存在 |

####  **地址：** `pictures/:collectionName/:picName`
- **说明：** 直接返回图片本身
- **方法：** `GET`
- **请求参数：** 拼合到路径中
    | 参数           | 说明             |
    | -------------- | ---------------- |
    | collectionName | 图片所属的收藏夹 |
    | picName        | 图片名称         |

- **返回示例：**
    ```
    Cache-Control: max-age=604800
    Content-Length: 7427628
    Content-Type: image/png

    *一堆图片二进制数据*
    ```


### config.js
- 一个常量就是一个配置项
- 使用.js作为配置项，就可以直接把配置import到程序里，不用读取文件什么的了
- 缺点是没法动态读取配置，配置修改后要重启服务

| 配置项        | 默认值                                          | 说明                                                                                                                                                                                                                                                                                                                                        |
| ------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| port          | 3000                                            | 程序使用的端口。如果和其他程序有冲突，就得改成其他的（建议在1000-65535之间）                                                                                                                                                                                                                                                                |
| allowedPicExt | `[".jpg", ".jpeg", ".png"]`                     | 只检测拥有这个列表里的格式的文件。也可以添加其他非图片的格式，不过这还需要稍微修改一下代码，以便于程序能够正确输出它的MimeType                                                                                                                                                                                                              |
| docUrl        | `https://github.com/yige233/randomPic#readme`   | API的文档链接                                                                                                                                                                                                                                                                                                                               |
| enableMd5     | false                                           | 是否在输出图片时为图片添加md5信息，即添加`Content-MD5`头                                                                                                                                                                                                                                                                                    |
| collections   | `{ collectionName : [ source1, source2, ...] }` | 核心配置。此处配置api将用到的图片的源。下面称其为 `图册` 。<br> 图册下面有多个收藏夹，每个收藏夹都是图册的一个属性。属性名可随意，但不能使用这些特殊字符：` / \| \ : ? @ # = ; `。该属性名也作为该收藏夹的名称。<br> 收藏夹的值是一个数组，数组内是若干个驱动对象。<br> 驱动对象的用处，是用来将不同类型的图片源整合成api可统一访问的形式。 |

- 驱动对象的结构：`{ type, data }`

  | type可选的值  | 说明                                          | 对应的data的结构                                  | 说明                                                                                                                |
  | ------------- | --------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
  | localFolder   | 表示类型为本地文件夹（会遍历子文件夹）        | `[folderPath, ...]`                               | 数组，元素是文件夹路径。Windows下路径中的反斜杠应改成正斜杠: \ => /                                                 |
  | localPic      | 表示类型为本地文件                            | `[picPath, ...]`                                  | 数组，元素是文件路径。Windows下路径中的反斜杠应改成正斜杠: \ => /                                                   |
  | AlistV3Folder | 表示类型为Alist V3 文件夹（不会遍历子文件夹） | `{ host: string, paths: array, ?passwd: string }` | 数组，元素是一个对象，分别有`host`(alist地址)、`paths`(数组，元素是alist文件夹挂载路径)和`passwd`(访问密码)三个属性 |
  | AlistV3Pic    | 表示类型为Alist V3 文件                       | `{ host: string, paths: array, ?passwd: string }` | 数组，元素是一个对象，分别有`host`(alist地址)、`paths`(数组，元素是alist文件路径)和`passwd`(访问密码)三个属性       |
