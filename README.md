# randomPic | 简单的 api，用于随机输出图片

## 如何使用？

1. 前往[Releases](https://github.com/yige233/randomPicv2/releases/tag/v2.0)，下载`randomPicv2ForWindows.zip`
2. 解压压缩包，找到`双击启动.cmd`，运行它。
3. 如果命令行黑框中给出了 api 的 url 链接（一般是[http://localhost:3000/info](http://localhost:3000/info)），就说明 api 已经启动成功。
4. 为了使 api 能够输出图片，还需要向刚刚程序生成的`Pics`文件夹中放入一些图片。

5. 浏览器访问
   [http://localhost:3000/random-picture?302](http://localhost:3000/random-picture?302)，就会从 Pics 文件夹中挑选一张随机的图片，并显示出来。

以上是默认情况，如果有修改 config.js，情况可能会有所不同，比如程序试图使用的端口已经被占用、修改了程序使用的图片源。

<details>
<summary>Q:黑框太丑，怎么办？</summary>

可以把它做成服务，随电脑启动而启动，且在后台持续运行，没有黑框。

1. 前往[Releases](https://github.com/yige233/randomPicv2/releases/tag/v2.0)，下载`randomPicv2ForWindows.zip`
2. 解压压缩包，找到`安装服务.cmd`，使用管理员身份运行它。
3. 完成！
4. 如果需要卸载服务，那么找到`卸载服务.cmd`，使用管理员身份运行它。

</details>

## 一些说明

由于改的东西有一点多，代码几乎都是新写的，所以新开了一个仓库。旧仓库在[randomPic](https://github.com/yige233/randomPic)。

- 直接访问网站不再直接提供图片，需要使用下面列出的 API。
- V2 对 API 进行了大量修改，因此不能兼容使用 V1 API 的程序。
- 对比 V1，V2 的 API 更加规整了，以及多了些有的没的的细节更改

### config.js

- 一个常量就是一个配置项
- 使用.js 作为配置项，就可以直接把配置 import 到程序里，不用读取文件什么的了
- 缺点是没法动态读取配置，配置修改后要重启服务
- <details>
  <summary>配置项说明</summary>

  | 配置项        | 默认值                                          | 说明                                                                                                                                                                                                                                                                                                                                          |
  | ------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | port          | 3000                                            | 程序使用的端口。如果和其他程序有冲突，就得改成其他的（建议在 1000-65535 之间）                                                                                                                                                                                                                                                                |
  | allowedPicExt | `[".jpg", ".jpeg", ".png"]`                     | 只检测拥有这个列表里的格式的文件。也可以添加其他非图片的格式，不过这还需要稍微修改一下代码，以便于程序能够正确输出它的 MimeType                                                                                                                                                                                                               |
  | docUrl        | `https://github.com/yige233/randomPic#readme`   | API 的文档链接                                                                                                                                                                                                                                                                                                                                |
  | enableMd5     | false                                           | 是否在输出图片时为图片添加 md5 信息，即添加`Content-MD5`头                                                                                                                                                                                                                                                                                    |
  | collections   | `{ collectionName : [ source1, source2, ...] }` | 核心配置。此处配置 api 将用到的图片的源。下面称其为 `图册` 。<br> 图册下面有多个收藏夹，每个收藏夹都是图册的一个属性。属性名可随意，但不能使用这些特殊字符：`/ \| \ : ? @ # = ;`。该属性名也作为该收藏夹的名称。<br> 收藏夹的值是一个数组，数组内是若干个驱动对象。<br> 驱动对象的用处，是用来将不同类型的图片源整合成 api 可统一访问的形式。 |

  </details>

- 驱动对象的结构：`{ type, data }`
- <details>
    <summary>驱动对象说明</summary>

  | type 可选的值 | 说明                                           | 对应的 data 的结构                                | 说明                                                                                                                   |
  | ------------- | ---------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
  | localFolder   | 表示类型为本地文件夹（会遍历子文件夹）         | `[folderPath, ...]`                               | 数组，元素是文件夹路径。Windows 下路径中的反斜杠应改成正斜杠: \ => /                                                   |
  | localPic      | 表示类型为本地文件                             | `[picPath, ...]`                                  | 数组，元素是文件路径。Windows 下路径中的反斜杠应改成正斜杠: \ => /                                                     |
  | AlistV3Folder | 表示类型为 Alist V3 文件夹（不会遍历子文件夹） | `{ host: string, paths: array, ?passwd: string }` | 数组，元素是一个对象，分别有`host`(alist 地址)、`paths`(数组，元素是 alist 文件夹挂载路径)和`passwd`(访问密码)三个属性 |
  | AlistV3Pic    | 表示类型为 Alist V3 文件                       | `{ host: string, paths: array, ?passwd: string }` | 数组，元素是一个对象，分别有`host`(alist 地址)、`paths`(数组，元素是 alist 文件路径)和`passwd`(访问密码)三个属性       |

  </details>

### API

<details>
  <summary>概述</summary>
  
  - 如无特殊情形，响应体的`Content-Type`均为`application/json;charset=UTF-8`
  - 如无特殊情形，响应体的 json 结构应如下：

```
{
  "code": number,
  "status": string,
  "message": string,
  "data": object || null
}
```

| 参数    | 说明                                                                         |
| ------- | ---------------------------------------------------------------------------- |
| code    | 当次响应的 http 状态码                                                       |
| status  | 当次响应的状态。存在 http 状态码相同，而状态不同的情况。可能的状态见下方表格 |
| message | 人类可读的简短的响应信息。                                                   |
| data    | 响应的具体数据                                                               |

| 状态               | 状态码 | 说明                                   |
| ------------------ | ------ | -------------------------------------- |
| OK                 | 200    | OK                                     |
| incompleteParams   | 400    | 请求中缺乏某个参数                     |
| wrongPath          | 400    | 错误或不完整的 URL 路径                |
| pathNotFound       | 404    | 未找到指定的请求路径                   |
| collectionNotFound | 404    | 未找到指定的收藏夹                     |
| picNotFound        | 404    | 未找到指定的图片                       |
| methodNotAllowed   | 405    | 不允许的 http 方法                     |
| errSendingPic      | 500    | 发送图片时服务端出现错误，导致发送失败 |
| errServerConfig    | 500    | 服务端端配置可能有误，没有可用的图片   |
| notImplemented     | 501    | 不支持的 http 方法                     |

</details>

#### **端点：** `/info` 或 `/`

<details>

- **说明：** 获取 API 相关信息
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

| data 参数     | 类型   | 说明             |
| ------------- | ------ | ---------------- |
| version       | string | API 的版本       |
| collections   | array  | API 拥有的收藏夹 |
| collections[] | string | 收藏夹的名称     |
| doc           | string | API 的介绍文档   |

</details>

#### **端点：** `/cache`

<details>

- **说明：** 重建 API 缓存的图片信息。要包含有效的`x-master-token`头。
- **方法：** `DELETE`
- **请求参数：** 无
- **返回示例：**

  ```
  HTTP/1.1 204 No Content

  ```

  </details>

#### **端点：** `/random-picture`

<details>

- **说明：** 获取随机图片
- **方法：** `GET`
- **请求参数：** queryString
  | 参数 | 说明 |
  | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
  | collection | 指定指定从哪个收藏夹中获得随机图片。如果要指定多个，则各个收藏夹之间用分隔符隔开；不指定则从全部收藏夹随机；若指定的收藏夹不可用则会将其过滤 |
  | 302 | 若参数存在且其值不为 false，则响应将会自动跳转至随机到的图片地址 |
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

  | data 参数  | 类型   | 说明                                       |
  | ---------- | ------ | ------------------------------------------ |
  | pic        | string | 图片名                                     |
  | collection | string | 图片所属的收藏夹                           |
  | cachedAt   | number | 服务器上缓存图片信息的时间                 |
  | size       | number | 图片的大小。若为-1，则说明大小未知或不存在 |

</details>

#### **端点：** `pictures/:collectionName/:picName`

<details>

- **说明：** 直接返回图片本身
- **方法：** `GET`
- **请求参数：** 拼合到路径中
  | 参数 | 说明 |
  | -------------- | ---------------- |
  | collectionName | 图片所属的收藏夹 |
  | picName | 图片名称 |

- **返回示例：**

  ```
  Cache-Control: max-age=604800
  Content-Length: 7427628
  Content-Type: image/png

  *一堆图片二进制数据*
  ```

</details>

### 关于反向代理

如果需要反向代理，有一个应该注意的点：**反向代理的 URI 路径要以`/`结尾**

<details>
<summary>以 Apache 为例</summary>

如果想要将所有以`/randomPic`路径开头的请求都代理到本程序处理，正确的反代配置应该是：

```
ProxyPass "/randomPic/"  "http://localhost:3000/"
ProxyPassReverse "/randomPic/"  "http://localhost:3000/"
```

下面则是错误的配置：

```
ProxyPass "/randomPic"  "http://localhost:3000/"
ProxyPassReverse "/randomPic"  "http://localhost:3000/"
```

</destails>
