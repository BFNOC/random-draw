# 随机抽签系统

根目录是 Go 启动器，前端源码在 `web/`。发布时先构建前端，再由 Go 将 `web/dist` 嵌入到本地可执行文件中。

## 开发运行

```bash
pnpm --dir web install
pnpm --dir web dev
```

## 构建本地程序

```bash
./scripts/build.sh
```

脚本会先构建 `web/dist`，再编译 Go 二进制。不要跳过前端构建直接发布二进制，否则 Go 无法嵌入最新网页资源。

构建完成后运行：

```bash
./build/chouqian
```

默认监听 `127.0.0.1:18080` 并自动打开浏览器。需要更换端口时：

```bash
./build/chouqian -addr 127.0.0.1:18081
```

查看构建版本：

```bash
./build/chouqian -version
```

## 版本来源

根目录 `VERSION` 是唯一版本源。前端构建、Go 编译和 GitHub Actions Release 都读取这个文件；发布新版本时只改 `VERSION`。

## 结束音效

系统默认使用合成音效。控制台里的「结束音效」可以选择本地 MP3 或 WAV 文件，文件通过浏览器本地读取，不会上传；如果音频无法播放，会自动回到合成音效。
