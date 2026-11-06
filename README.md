# StylePrompt

一个公开浏览、由仓库维护者编辑的图片与提示词收藏库。每组收藏支持多张图片，点击图片复制提示词，保留换行；编辑器支持拖入、排序、移除及整组删除。

## 本地启动

使用 Node.js 22 或更新版本，无需安装依赖。

```sh
npm run dev
```

打开终端显示的本地地址，在右上角连接公开 GitHub 仓库。留空编辑凭证即为访客模式。可将本机仓库配置保存在被 Git 忽略的 `private/config/site.json`，格式为 `{ "repository": "OWNER/REPOSITORY" }`。文件中不要放凭证。

## 发布

1. 将源码放进一个已有初始提交的公开 GitHub 仓库，默认分支为 `main`。
2. 在仓库 Settings → Pages → Build and deployment 中选择 GitHub Actions。
3. 推送 `main` 或手动运行发布工作流，完成后打开工作流给出的 Pages 地址。
4. 网页会从部署环境自动取得仓库标识，无需在公开源码中写真实配置。

`npm run build` 将允许发布的网页文件输出到 `private/build/site`。只上传这个目录，不能把整个 `private/` 或项目根目录作为部署产物。

## 编辑权限

在 GitHub 创建 fine-grained personal access token，仅选择目标仓库，授予 Contents: Read and write。通过网页右上角的连接窗口输入。实际写入由 GitHub 验证；访客即使修改本地界面也不能绕过仓库权限。仓库规则可能额外限制写入。

凭证只存于当前页面内存，不存入 localStorage、Cookie、配置、URL 或仓库。关闭或刷新页面后需要重新输入；点击“退出编辑”可立即清除。只在自己控制、信任的网页及浏览器中输入凭证。纯前端编辑器无法对抗被篡改的网页脚本或恶意浏览器扩展。

## 模块与存储

| 模块 | 职责 |
| --- | --- |
| `src/AppSystem/` | 页面连接、复制反馈、基础样式 |
| `src/GalleryFeature/` | 分组图片墙与查看交互 |
| `src/EditorFeature/` | 图片草稿、排序、上传与删除 |
| `src/GitHubSystem/` | 数据校验、鉴权和 Git 提交 |
| `scripts/BuildSystem/` | 允许列表构建 |
| `scripts/PreviewSystem/` | 本地只读预览服务 |

收藏存在同一远端仓库的 `gallery-data` 分支：`catalog.json` 保存分组、提示词及图片尺寸，`images/` 保存原图。首次保存建立独立数据分支。网页通过 GitHub API 获取固定提交的快照，图片也读取同一提交；新增收藏无需重新部署网页。

保存先创建图片 blob 和目录树，再创建完整提交，最后以非强推方式更新分支。更新失败不显示成功，不清空草稿；两个页面同时保存时不覆盖对方修改。修改其他组可自动合并，修改同一组须刷新后重新编辑。网络在最后一步中断时，远端可能已保存，应先刷新确认再重试。

## 限制与替代操作

- 收藏公开可下载。删除只是从当前版本移除，Git 历史中仍可能保留原图和提示词。
- 单图最多 20 MB，一次编辑新增图片总量最多 60 MB，每组最多 30 张。支持 PNG、JPEG、WebP、GIF，保存原始字节，不自动压缩或去除元数据；不接受 SVG/HTML。
- 索引大小限制为 900 KB，提示词每组最多 100,000 字符。大量原图会累积 Git 历史，此工具不适合无限容量备份。
- 访客读取受 GitHub 未认证 API 额度约束，公共高流量站点不适合这条直连方案。读取失败会提示，不把失败当成空库。
- 复制被浏览器拒绝时，显示可手动复制的文本。触屏和键盘可使用前后移动按钮代替拖拽。图片加载失败仍可复制提示词。
- 网络或权限错误时保留当前页面草稿，不提供本地假保存或离线写入。原图还受 GitHub 可达性影响。
- GitHub 托管配置与公开规则以官方文档为准：[Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)、[访问凭证](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)。

## 验证

```sh
npm test
npm run build
```

自动化测试使用合成资料和模拟 GitHub 响应，验证事务、冲突、鉴权边界与数据校验，不向真实仓库写入测试收藏。
