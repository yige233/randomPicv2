//程序所运行在的端口
const port = 3000;

//允许的图片类型
const allowedPicExt = [".jpg", ".jpeg", ".png"];

//文档链接
const docUrl = "https://github.com/yige233/randomPicv2#readme";

//是否在输出图片时为再响应头中添加图片的图片md5信息
const enableMd5 = false;

//用于在delete cache时判断请求是否可信，避免大量请求拖慢服务端（其实一点都不可信，但是懒得搞太复杂。最好是改成只有自己知道的一串东西
const masterToken = "randomPicAPI";

/**
 * 重要！此处配置api将用到的图片的源。下面称其为 图册 。
 * 图册下面有多个收藏夹，每个收藏夹都是图册的一个属性。属性名可随意，但不能使用这些特殊字符：[ / | \ : ? @ # = ; ]。该属性名也作为该收藏夹的名称
 * 收藏夹的值是一个数组，数组内是若干个图片源对象。
 * 图片源对象的用处，是用来将不同类型的图片源整合成api可统一访问的形式
 * 目前有4个适配器：localFolder, localPic, AlistV3Folder, AlistV3Pic
 * 拥有两个属性:
 *     type:该图片源使用的适配器
 *     data:交给适配器处理的数据
 */

//表示从本地文件夹中获取图片（会遍历子文件夹）
const source1 = {
  type: "localFolder", //表示类型为本地文件夹
  data: ["./Pics"], //数组，元素是文件夹路径。Windows下路径中的反斜杠应改成正斜杠: \ => /
};

//表示使用给定的图片
const source2 = {
  type: "localPic", //表示类型为本地文件
  data: ["./test.png", "C:/Folder/test.jpg"], //数组，元素是文件路径。Windows下路径中的反斜杠应改成正斜杠: \ => /
};

//表示从Alist V3 的文件夹中获取图片（不遍历子文件夹）！！示例已经不可用
const source3 = {
  type: "AlistV3Folder", //表示类型为Alist V3 文件夹
  data: [{ host: "https://al.nn.ci", passwd: "", paths: ["/"] }], //数组，元素是一个对象，分别有host(alist地址)、path(alist文件夹挂载路径)和passwd(访问密码)三个属性
};

//表示从Alist V3 中获取给定的图片 ！！示例已经不可用
const source4 = {
  type: "AlistV3Pic", //表示类型为Alist V3 图片
  data: [{ host: "https://al.nn.ci", passwd: "", paths: ["/alist.png"] }], //数组，元素是一个对象，分别有host(alist地址)、path(数组，元素是alist文件挂载路径)和passwd(访问密码)三个属性
};

//下面的配置表示：图册内有一个名为"Default"的收藏夹，它使用了 source1 作为图片的来源；名为"Test"的收藏夹则是空的
const collections = {
  Default: [source1],
  Test: [],
};

//导出配置。不要动就可以
export { port, collections, allowedPicExt, docUrl, enableMd5, masterToken };
