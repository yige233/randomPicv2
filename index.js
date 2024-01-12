import crypto from "crypto";
import fs from "fs";
import http from "http";
import https from "https";
import path from "path";
import {
  allowedPicExt,
  collections,
  docUrl,
  enableMd5,
  port,
  masterToken,
} from "./config.js";

const fsp = fs.promises;

const version = "2.1";

//图片适配器
const Adapters = new Map();

class Log {
  static colors = {
    log: 32,
    trace: 36,
    error: 31,
    warn: 33,
    info: 34,
  };
  static _print(level = "info", ...params) {
    const date = new Date();
    if (!["info", "log", "trace", "error", "warn"].includes(level))
      level = "info";
    console[level](
      `[${date.toLocaleDateString()} ${date.toLocaleTimeString()}] [\x1b[${Log.colors[level]}m${level
        .padStart(5)
        .toUpperCase()}\x1b[0m]`,
      ...params
    );
  }
  static trace(...params) {
    Log._print("trace", ...params);
  }
  static error(...params) {
    Log._print("error", ...params);
  }
  static log(...params) {
    Log._print("log", ...params);
  }
  static warn(...params) {
    Log._print("warn", ...params);
  }
  static info(...params) {
    Log._print("info", ...params);
  }
}

class Tool {
  //获取时间戳，可以指定偏移量
  static now(offset = 0) {
    return Math.floor(new Date() / 1e3) + offset;
  }
  //测试文件夹是否存在
  static async testPath(dir) {
    try {
      const res = await fsp.stat(dir);
      return res.isDirectory();
    } catch (err) {
      return false;
    }
  }
  //创建文件夹
  static async makeDir(dir) {
    if (await Tool.testPath(dir)) return; //路径存在，直接返回
    const parentDir = path.parse(dir).dir;
    if (!(await Tool.testPath(parentDir))) {
      await Tool.makeDir(parentDir);
    }
    //父路径不存在，创建父级路径
    await fsp.mkdir(dir).catch((err) => {
      Log.warn(`[Tool.Makedir] 创建文件夹 < ${dir} > 失败:`, err.message);
    });
  }
  //获取摘要
  static hash(data = 0, algorithm = "shake256") {
    const hash =
      algorithm == "shake256"
        ? crypto.createHash("shake256", { outputLength: 4 })
        : crypto.createHash(algorithm);
    hash.update(data);
    return hash.digest("hex");
  }
  //发出http请求
  static request(url, options = {}) {
    return new Promise((resolve, reject) => {
      const { protocol, host, hostname, pathname, search } = new URL(url);
      const {
        method,
        headers = {},
        signal,
        body,
        redirect = "follow",
      } = options;
      const [handler, defaultPort] =
        protocol == "https:" ? [https, 443] : [http, 80];
      const request = {
        host: hostname,
        method: method || "get",
        path: pathname + search,
        port: host.split(":")[1] || defaultPort,
        headers: {},
      };
      const abortControl = new AbortController();
      const abortSignal = signal || abortControl.signal;
      if (body) {
        request.headers["Content-Length"] = Buffer.from(
          options.body
        ).byteLength;
      }
      Object.assign(request.headers, headers);
      const req = handler.request(request, (res) => {
        const body = [];
        const response = {
          status: res.statusCode,
          headers: res.headers,
          body: null,
          json() {
            return JSON.parse(this.body.toString());
          },
          blob() {
            return this.body;
          },
        };
        res.on("data", (data) => body.push(data));
        res.on("end", () => {
          Log.log(
            "[Tool.Request]",
            method || "get",
            decodeURI(url),
            response.status
          );
          if (response.headers["location"] && redirect == "follow") {
            return resolve(Tool.request(response.headers["location"], options));
          }
          response.body = Buffer.concat(body);
          resolve(response);
        });
      });
      req.on("error", (e) => reject(new Error(`请求发生错误: ${e.message}`)));
      if (body) {
        req.write(Buffer.from(body));
      }
      abortSignal.onabort = () => {
        req.destroy();
        reject(new Error("请求被中止或超时"));
      };
      setTimeout(() => abortControl.abort(), 10000); //10秒后中止请求
      req.end();
    });
  }
  static get mimeType() {
    return new Map([
      [".jpg", "image/jpeg"],
      [".jpeg", "image/jpeg"],
      [".png", "image/png"],
      [".txt", "text/plain"],
    ]);
  }
}

//图册
class PicAlbum extends Map {
  index = {};
  //传入配置
  constructor(collections) {
    super();
    for (const collection in collections) {
      const bannedChar = /[\/|\||\\|:|?|@|#|=|;]/i;
      if (this.has(collection))
        throw new Error(`重复的收藏夹名称: ${collection}`);
      if (collection.search(bannedChar) != -1)
        throw new Error(
          `收藏夹 '${collection}' 的名称中含有不允许的字符: ${collection.match(
            bannedChar
          )}`
        );
      this.set(collection, new Collection(collection, collections[collection]));
    }
    Object.assign(this.index, collections);
  }
  //刷新缓存
  async cache() {
    for (let i of this.directory) await this.get(i).cache();
  }
  //图册目录
  get directory() {
    const dir = [];
    for (let i in this.index) dir.push(i);
    return dir;
  }
}

//图册内的单个收藏夹
class Collection extends Map {
  caching = false;
  timestamp = 0;
  refresh = 3600; //最多3600s，刷新缓存
  constructor(name, collection) {
    super();
    this.name = name;
    this.index = collection;
  }
  //刷新缓存
  async cache() {
    this.caching = true;
    for (const i in this.index) {
      const source = this.index[i];
      if (!source.type || !Adapters.has(source.type)) continue;
      try {
        const newData = await Adapters.get(source.type)(source.data);
        for (let i of newData.keys()) {
          this.set(i, newData.get(i));
        }
      } catch (err) {
        Log.warn(
          `[Collection.Cache] 加载 < ${this.name} > 中的第 ${
            Number(i) + 1
          } 个时出错:`,
          err.message || err
        );
      }
    }
    this.caching = false;
    this.timestamp = Tool.now(); //时间戳
  }
  //获取收藏夹内的图片
  async getPic(option = "random", picId = "") {
    if (this.timestamp <= Tool.now(~this.refresh) && this.caching == false) {
      //如果缓存过期或者没有缓存，就运行缓存程序。但不使用await，避免阻塞
      this.cache();
    }
    if (this.size == 0)
      throw new Error(`收藏夹 '${this.name}' 内没有可用的图片。`); //没有图片可用
    if (option == "exact") {
      //通过图片名精确查找图片
      if (this.has(picId)) return this.get(picId); //返回该图片的数据
      throw new Error(`收藏夹 '${this.name}' 内没有找到指定的图片: ${picId}`);
    }
    const picsArr = [...this.keys()];
    return this.get(picsArr[Math.floor(Math.random() * picsArr.length)]); //返回随机的图片数据
  }
}

//api路由
class Router {
  //定义一些状态码
  static get statuses() {
    return new Map([
      ["OK", [200, "OK", "OK"]],
      ["incompleteParams", [400, "incompleteParams"]],
      ["wrongPath", [400, "wrongPath", "错误或不完整的URL路径"]],
      [
        "masterTokinInvalid",
        [403, "masterTokinInvalid", "masterToken错误，或者未提供masterToken"],
      ],
      ["pathNotFound", [404, "pathNotFound", "未找到指定的请求路径"]],
      ["collectionNotFound", [404, "collectionNotFound"]],
      ["picNotFound", [404, "picNotFound"]],
      ["methodNotAllowed", [405, "methodNotAllowed"]],
      ["errSendingPic", [500, "errSendingPic"]],
      [
        "errServerConfig",
        [500, "errServerConfig", "服务端端配置可能有误，没有可用的图片"],
      ],
      ["notImplemented", [405, "notImplemented"]],
    ]);
  }
  //子路由集合
  routes = new Map();
  //默认情况下的响应
  default = (req, res) => {
    res.response("pathNotFound");
  };
  constructor(id = null) {
    this.id = id;
    for (let i of ["get", "post", "delete", "put", "use"]) {
      this[i] = (paths, handler) => {
        for (const path of Array.isArray(paths) ? paths : [paths]) {
          if (this.routes.has(path)) {
            return this.routes.get(path)[0].push(i);
          }
          this.routes.set(path, [[i], handler]);
        }
      };
    }
  }
  //统一使用的头
  get headers() {
    return {
      "Content-Type": "application/json;charset=UTF-8",
      "Access-Control-Allow-Origin": "*",
    };
  }
  //路由入口
  portal(req, res, relativeLength = 0) {
    const { pathname, searchParams } = new URL("http://t.t" + req.url);
    //定义一些属性和方法方便操作
    req.relativePath = pathname.slice(relativeLength || 0);
    req.currentPath = "/" + req.relativePath.split("/")[1];
    req.isEndPoint = req.relativePath.split("/")[2] ? false : true;
    req.getParam = (param) => searchParams.get(param);
    res.response = (statusCode, messageText = null, data = null) => {
      const [code, status, message = messageText || ""] =
        Router.statuses.get(statusCode);
      const json = { code, status, message };
      res.statusCode = code;
      json.data = json.code == 200 && data ? data : null;
      return res.logEnd(JSON.stringify(json));
    };
    res.logEnd = (...params) => {
      const ip = req.headers["x-forwarded-for"]
        ? req.headers["x-forwarded-for"].split(",")[0]
        : req.socket.remoteAddress;
      const print =
        res.statusCode >= 500
          ? Log.error
          : res.statusCode >= 400
          ? Log.warn
          : Log.log;
      print(
        "[Router.Log]",
        ip,
        req.method,
        decodeURIComponent(req.url),
        res.statusCode
      );
      if (res.noResBody) {
        return res.end();
      }
      res.end(...params);
    };
    for (let header in this.headers) {
      res.setHeader(header, this.headers[header]);
    }
    //从子路由表中寻找匹配的项目
    for (let i of [...this.routes.keys()]) {
      const method = req.method.toLocaleLowerCase();
      //通过条件：相对路径完全等于i；相对路径的前(i.length)个字符等于i，且相对路径的第(i.length+1)个字符为"/"
      if (
        i == req.relativePath ||
        (i == req.relativePath.slice(0, i.length) &&
          req.relativePath.split("")[i.length] == "/")
      ) {
        const [methods, handler] = this.routes.get(i);
        //拒绝响应奇怪的请求方法
        if (
          !["get", "post", "put", "delete", "options", "head"].includes(method)
        ) {
          return res.response("notImplemented", `不支持的方法: ${method}`);
        }
        //交给use处理
        if (methods.includes("use")) {
          return handler.portal(req, res, relativeLength + i.length);
        }
        //不是端点，但没有能处理它的方法，响应为：错误路径
        if (!req.isEndPoint) {
          return res.response("wrongPath");
        }
        //响应options
        if (method == "options") {
          res.noResBody = true;
          res.setHeader("Allow", methods.join(","));
          return handler(req, res);
        }
        //响应head请求
        if (method == "head" && methods.includes("get")) {
          res.noResBody = true;
          return handler(req, res);
        }
        //不支持的请求方法
        if (!methods.includes(method)) {
          res.setHeader("Allow", methods.join(","));
          return res.response(
            "methodNotAllowed",
            `不允许使用的方法: ${method}`
          );
        }
        return handler(req, res);
      }
    }
    this.default(req, res, relativeLength);
  }
  setDefault(func) {
    this.default = func;
  }
}

class AlistV3 {
  host = null;
  settings = {};
  constructor(host) {
    this.host = host;
  }
  async init() {
    const res = await Tool.request(`${this.host}/api/public/settings`);
    const siteInfo = res.json();
    if (siteInfo.code != 200) {
      throw new Error(`无法访问${this.host}:${siteInfo.message}`);
    }
    this.settings = siteInfo.data;
  }
  async list(path, passwd = "") {
    const res = await Tool.request(`${this.host}/api/fs/list`, {
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
      },
      method: "post",
      body: JSON.stringify({
        path: path,
        password: passwd || "",
        page: 1,
        per_page: 0,
      }),
    });
    const json = res.json();
    if (json.code != 200) {
      throw new Error(
        `${this.host}:获取文件列表 < ${path} > 失败: ${json.message}`
      );
    }
    return json.data.content;
  }
  async fileMeta(path, passwd = "") {
    const res = await Tool.request(`${this.host}/api/fs/get`, {
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
      },
      method: "post",
      body: JSON.stringify({ path: path, password: passwd }),
    });
    const json = res.json();
    if (json.code != 200) {
      throw new Error(`获取文件元数据失败: ${json.message}`);
    }
    return json.data;
  }
  async get(path, passwd = "") {
    const fileMeta = await this.fileMeta(path, passwd);
    const fileData = await Tool.request(fileMeta.raw_url);
    if (fileData.status >= 400)
      throw new Error(`获取文件数据 < ${path} > 失败: ${fileData.message}`);
    return fileData.blob();
  }
  static assign(path, name) {
    let split = "/";
    if (path[path.length - 1] == "/") split = "";
    return path + split + name;
  }
}

/**
 * 注册图片源的适配器，set适配器的id和处理函数，处理函数最终返回一个Map，Map中单个key对应的value的结构如下：
 * picId => {
      pic: picId,//图片的id
      data: () => (),//一个函数，调用该函数时返回图片的二进制数据
      type: mimeType,//图片的mimetype
      size: -1,//图片的大小(B)，可不存在
    }
 */
Adapters.set("localFolder", async function (picDirs) {
  async function singleFolder(dir, data) {
    //对单个文件夹进行获取文件的操作。
    try {
      const fsHandle = await fsp.readdir(dir); //读取文件夹
      for (let child of fsHandle) {
        //对于每一个项目：
        const picPath = path.join(dir, child); //拼接为完整路径
        const stat = await fsp.stat(picPath);
        if (stat.isDirectory()) {
          //如果路径是文件夹，循环调用自身，获取该文件夹下面的图片，并将结果进行合并
          data = new Map([...(await singleFolder(picPath, data)), ...data]);
        } else if (
          allowedPicExt.includes(path.extname(picPath).toLocaleLowerCase())
        ) {
          //如果路径是图片：
          const picId = Tool.hash(picPath) + "." + path.basename(picPath);
          const picExt = path.extname(picPath).toLocaleLowerCase();
          data.set(picId, {
            pic: picId, //必须，图片的名称
            data: () => fsp.readFile(picPath), //必须，用于获取图片数据的函数
            type: Tool.mimeType.get(picExt), //必须，图片的类型
            size: stat.size, //图片的大小
          }); //将图片名=>图片路径的对应关系放入Map
        }
      }
      return data;
    } catch (err) {
      Log.warn(
        `[Adapter.LocalFolder] 读取文件夹 < ${dir} > 时出现错误:`,
        err.message
      );
      return data;
    }
  }
  let data = new Map();
  for (let dir of Array.isArray(picDirs) ? picDirs : [picDirs]) {
    await Tool.makeDir(dir); //如文件夹不存在，则创建文件夹
    data = new Map([...(await singleFolder(dir, data)), ...data]);
  } //循环遍历多个文件夹。
  return data;
});
Adapters.set("localPic", async function (picPaths) {
  const data = new Map();
  for (let picPath of Array.isArray(picPaths) ? picPaths : [picPaths]) {
    try {
      const stat = await fsp.stat(picPath);
      if (
        stat.isDirectory() ||
        !allowedPicExt.includes(path.extname(picPath).toLocaleLowerCase())
      )
        continue;
      //如果路径是文件且是允许的图片，
      const picId = Tool.hash(picPath) + "." + path.basename(picPath);
      const picExt = path.extname(picPath).toLocaleLowerCase();
      data.set(picId, {
        pic: picId,
        data: () => fsp.readFile(picPath),
        type: Tool.mimeType.get(picExt),
        size: stat.size,
      });
    } catch {}
  }
  return data;
});
Adapters.set("AlistV3Folder", async function (sites) {
  const data = new Map();
  for (const site of Array.isArray(sites) ? sites : [sites]) {
    const { host, paths, passwd } = site;
    if (!host) throw new Error("需要提供alist服务的地址");
    const alist = new AlistV3(host);
    await alist.init();
    for (const folderPath of Array.isArray(paths) ? paths : [paths]) {
      const content = await alist.list(folderPath, passwd);
      for (const { name, is_dir, size, type } of content) {
        if (type != 5 || is_dir) continue;
        const picExt = name.split(".")[name.split(".").length - 1];
        const ext =
          Tool.mimeType.get("." + picExt) || Tool.mimeType.get(".txt");
        if (ext == "text/plain") continue;
        const picId =
          Tool.hash(AlistV3.assign(host + folderPath, name)) + "." + name;
        data.set(picId, {
          pic: picId,
          type: ext,
          size: size,
          data: () => alist.get(AlistV3.assign(folderPath, name), passwd),
        });
      }
    }
  }
  return data;
});
Adapters.set("AlistV3Pic", async function (sites) {
  const data = new Map();
  for (const site of Array.isArray(sites) ? sites : [sites]) {
    const { host, paths, passwd } = site;
    if (!host) throw new Error("需要提供alist服务的地址");
    const alist = new AlistV3(host);
    await alist.init();
    for (const picPath of Array.isArray(paths) ? paths : [paths]) {
      const { name, is_dir, size, type } = await alist.fileMeta(
        picPath,
        passwd
      );
      if (is_dir || type != 5 || !name) continue;
      const picExt = name.split(".")[name.split(".").length - 1];
      const ext = Tool.mimeType.get("." + picExt) || Tool.mimeType.get(".txt");
      const picId = Tool.hash(host + picPath) + "." + name;
      if (ext == "text/plain") continue;
      data.set(picId, {
        pic: picId,
        type: ext,
        size: size,
        data: async () => alist.get(picPath, passwd),
      });
    }
  }
  return data;
});

//App
(async () => {
  const routerRoot = new Router();
  const routerCol = new Router();
  const routerPic = new Router();
  const picAlbum = new PicAlbum(collections);
  const server = http.createServer(routerRoot.portal.bind(routerRoot));
  //获取api相关信息
  routerRoot.get(["/info", "/"], (req, res) =>
    res.response("OK", null, {
      version: version,
      doc: docUrl,
      collections: picAlbum.directory,
    })
  );
  //获取随机图片
  routerRoot.get("/random-picture", async (req, res) => {
    let randomCols = [];
    const targetCols = req.getParam("collection"); //collection参数，指定从哪个收藏夹中获得随机图片
    const auto302 = req.getParam("302"); //302参数，决定是否直接跳转到随机到的图片。值为不 false 时，视为通过
    if (picAlbum.directory.length == 0) {
      return res.response("errServerConfig");
    }
    if (!targetCols) {
      //没有指定收藏夹，从全部收藏夹中随机
      randomCols = picAlbum.directory;
    } else {
      //指定了一个或多个收藏夹，从指定收藏夹中随机；如果指定的收藏夹不可用，依照没有指定收藏夹来处理
      for (let i of targetCols.split("|")) {
        if (picAlbum.directory.includes(i)) {
          randomCols.push(i);
        }
      }
      if (randomCols.length == 0) {
        randomCols = picAlbum.directory;
      }
    }
    const collection = (() => {
      const arr = []; //建立一个数组，其中每个元素的值都是前面元素的累加
      for (let i in randomCols) {
        arr.push((arr[i - 1] || 0) + picAlbum.get(randomCols[i]).size);
      }
      const luckyNum = Math.floor(Math.random() * arr[arr.length - 1] + 1); //在 1 到之前累加的 最大值+1 的范围内生成随机数
      for (let i in arr) {
        if (luckyNum > arr[i]) continue; //如果随机数大于某项的累加，说明没有随机到该项
        return picAlbum.get(randomCols[i]);
      }
      return picAlbum.get(randomCols[0]); //如果随机数大于最大的累加值，那么只能说明参与该次随机的所有收藏夹都是空的
    })();
    try {
      const result = await collection.getPic();
      if (![null, "false"].includes(auto302)) {
        //302跳转到对应图片地址
        res.removeHeader("Content-Type");
        res.writeHead(302, {
          Location: `./pictures/${encodeURI(collection.name)}/${encodeURI(
            result.pic
          )}`,
        });
        return res.logEnd();
      }
      return res.response("OK", null, {
        pic: result.pic,
        collection: collection.name,
        cachedAt: collection.timestamp,
        size: result.size || -1,
      });
    } catch (err) {
      return res.response(
        "picNotFound",
        `指定的收藏夹 '${randomCols.join("、")}' 内没有可用的图片`
      );
    }
  });
  //重建缓存
  routerRoot.delete("/cache", (req, res) => {
    if (
      !req.headers["x-master-token"] ||
      req.headers["x-master-token"] != (masterToken || "randomPicAPI")
    ) {
      return res.response("masterTokinInvalid");
    }
    const collectionName = req.getParam("collection"); //collection参数，指定刷新哪个收藏夹；如果没有指定收藏夹，默认为所有收藏夹
    res.statusCode = 204;
    res.removeHeader("Content-Type");
    if (picAlbum.directory.includes(collectionName)) {
      picAlbum.get(collectionName).cache();
      Log.log("[App.Cache]", "缓存被刷新:", collectionName);
    } else {
      picAlbum.cache();
      Log.log("[App.Cache]", "全部缓存被刷新");
    }
    return res.logEnd();
  });
  //获取特定图片-路由到收藏夹
  routerCol.setDefault((req, res, relativeLength) => {
    const collectionName = decodeURIComponent(req.currentPath).slice(1);
    if (req.isEndPoint) {
      return res.response("wrongPath");
    }
    if (!picAlbum.has(collectionName)) {
      return res.response(
        "collectionNotFound",
        `指定的收藏夹 '${collectionName}' 不存在。`
      );
    }
    req.collectionName = collectionName;
    routerPic.portal.bind(routerPic)(
      req,
      res,
      relativeLength + req.currentPath.length
    );
  });
  //获取特定图片-路由到图片
  routerPic.setDefault(async (req, res, relativeLength) => {
    const picId = decodeURIComponent(req.currentPath).slice(1);
    const collection = await picAlbum.get(req.collectionName);
    let result = undefined;
    if (!req.isEndPoint) {
      return res.response("wrongPath");
    }

    try {
      result = await collection.getPic("exact", picId);
    } catch (err) {
      return res.response("picNotFound", err.message);
    }
    try {
      const blob = await result.data();
      const headers = {
        //设置响应头，设置缓存
        "Content-Type": result.type,
        "Content-Length": result.size,
        "Cache-Control": "max-age=604800",
      };
      if (enableMd5) headers["Content-MD5"] = Tool.hash(blob, "md5");
      res.writeHead(200, headers);
      return res.logEnd(blob);
    } catch (err) {
      Log.error("[App.Picture] 发送图片失败: \n", err);
      return res.response(
        "errSendingPic",
        `服务端在发送图片时出现了错误: ${err.message || err}`
      );
    }
  });
  routerRoot.use("/pictures", routerCol);
  Log.log("[App] 正在启动服务…");
  await picAlbum.cache();
  server.listen(port, () =>
    Log.log(`[App] 服务启动成功: http://localhost:${port}/info`)
  ); //开启服务器
})();
