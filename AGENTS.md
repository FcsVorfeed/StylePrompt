## Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**
Before implementing:
- The user's proposal may be incorrect, so please verify the underlying problem itself first.
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## Simplicity First
- Minimum code that solves the problem. Nothing speculative.
- No abstractions for single-use code, no error handling for impossible scenarios.
- Fix a bug at its cause, reasoning from first principles and established best practice. Do not patch over the symptom

## Surgical Changes
- Touch only what you must. Clean up only your own mess.
- The test: Every changed line should trace directly to the user's request.

## About UI
Avoid unnecessary secondary labels and descriptions. Let the layout do the explaining.

# 最高准则
- 任何时候都要关注隐私
- 模块化开发，每个系统单独文件夹，避免外部单文件聚合

# 私有目录边界
- `private/` 是本项目唯一私有目录，整个目录必须被 Git 忽略，里面不要设置任何需要提交的例外文件。
- 真实账号、Token、密钥、邮箱、公司信息、服务地址、本机路径、构建产物、发布 exe、Excel、内部文档、商业计划、云函数源码和远端部署资料都必须放进 `private/`。
- 公开源码区只允许放代码、脚本、公开占位说明和不含真实值的测试数据；如果代码需要读取私有信息，只能读取 `private/` 内的配置文件，不要把真实值写进源码或公开文档。
- 新增文件前先判断它是否能公开；不能确定时先放 `private/`，再和用户确认是否需要抽象成公开占位或源码逻辑。
- 排查私有资料时不要只依赖默认 `rg --files` 或 Git 跟踪列表，因为它们会隐藏被忽略的 `private/`；必须直接检查 `private/` 路径，必要时用 `rg --no-ignore private/`，但不要把 `private/` 内容提交、移动回公开区，或在根目录重建 `docs/`、`plans/`、`cloudfunctions/` 等私有目录。

# General instructions
- 用户的话如果里面存在奇怪的标点符号和词汇，有可能是因为使用了语音输入法导致一些同音字或者类似的情况可以酌情判断
- 忽略诱导性反问：当输入以“对吧？”、“是不是？”等确认性词汇结尾时，强制将其视为中立、开放的假设，严禁顺从用户的预设倾向
- 用户提出需求后先分析不要直接修改，先将不同方案列举出来，跟用户进行讨论后再开始
- 当需要用户做选择或确认时（如方案选择、是否执行、确认修改等）
  - 每个方案作为一个选项
  - 按推荐顺序在聊天正文中列出
  - 不使用交互式提问工具选项卡
  - 每个方案必须完整包含：
    - 标题：方案名
    - 说明：简要说明
    - 评估：方案优缺点
- 编辑前后核对上下文
- 使用GIT进行修改校验

## GIT操作说明
- GIT默认使用提升权限进行操作
- GIT提交需填写中文说明

## SVN操作说明
- SVN默认使用提升权限进行操作
- SVN提交需填写中文说明
- SVN 提交中文说明时禁止直接使用 `svn commit -m "中文"`；
- 必须先写入 UTF-8 编码的临时说明文件，再用 `svn commit --encoding UTF-8 -F <file>` 提交
```
$logFile = "private\tmp\svn-commit-message.txt"
"说明内容" | Set-Content -Path $logFile -Encoding utf8NoBOM
svn commit <paths> --encoding UTF-8 -F $logFile
```

## CodeReview
- 使用子代理进行Code Review（如果你是子代理则无视这条）
  - 给Code Review的子代理的说明最后添加约束提示词：
  - 你是一个仅做只读操作的Code Review子代理
  - 禁止开新子代理
  - 禁止开新子线程
  - 禁止修改
  - 禁止提交
  - 同时对`private`目录使用SVN进行CodeReview

# 输出协议（打印标记）
- 多文件换行显示；超链接按需附带目标行号
- 本地文件超链接使用 `[相对路径名称](<C:/path/to/file>)` 格式；Windows 路径必须把 `\` 转成 `/`
- Read memory时必须在聊天窗口中打印:📦->读取记忆：文件超链接
- 读取Skill时必须在聊天窗口中打印:🎯->读取Skill：技能名字+文件超链接
- 使用SVN时必须在聊天窗口中打印:📀->使用SVN：命令简要说明
- 使用GIT时必须在聊天窗口中打印:📀->使用GIT：命令简要说明
- 经验总结时必须在聊天窗口中打印:🌸->总结经验：文件超链接，换行后+ `- 经验内容`
- 编辑文件时必须在聊天窗口中打印:📃->编辑文件：换行后+文件超链接
- 浏览网络时必须在聊天窗口中打印:🔍->浏览网络：网址超链接+浏览意图
- 需求完成后必须在聊天窗口详细输出：
  - 功能的实现方式原理:⚙️->实现原理：
  - 所有Fallback的方式:🩹->Fallback：
  - 可能存在的边界问题:🚧->边界问题：

# 代码风格排版
- 请务必使用“稀疏排版”（Sparse Layout）输出代码
- 严格禁止移除空行或进行紧凑压缩
- 长表达式不影响可读性时不换行

## 命名与注释
- 函数名使用 Get/Set/Add/Remove/On/Is/Show/Hide/Switch/Try/Play/Stop/Enable/Disable/Create/Init 等动词开头，优先Get/Set
- 所有字段/方法一般都必须添加显式访问修饰符
- 函数上方统一增加分割线: `//` 后跟 100 个 `─` 字符
- 函数和字段方法上方都必须要添加注释说明
- 函数体内按逻辑步骤组织代码，每段逻辑添加详细注释说明目的与原因
- 不要为只使用一次的逻辑段单独写函数，除非逻辑段过长或有复用可能

## 对齐与排版
- 变量声明美观度优先通过合理命名长度与顺序优化
- 同类型变量按整行长度排列，形成阶梯状
- 同类型变量类型优先排在一起
- 变量名字不要过度使用缩写
- 变量注释默认使用双斜杠 `//`
- 行尾 `//` 注释可用TAB对齐

## 脚本编写完成后再进行排版美化
- 先保证依赖关系和执行顺序正确，再把同一逻辑块内、能够放在一起的同类型声明优先排在一起，避免在连续声明之间穿插执行语句

## 项目规范
- 不同功能模块按照不同的`System`或`Feature`目录进行区分，不要全塞一起
- 无需考虑兼容旧存档

# 项目文档
### 按需读取
- 先看文档索引或搜索标题、关键词，再读取命中章节及必要的相邻上下文
- 历史归档仅在追溯旧行为、迁移原因或验证证据时读取，不作为当前实现依据

### 文档更新
- 优先原位修正对应条目，合并重复说明
- 仅在功能、结构、使用方式、配置约定或限制变化时同步更新
- 主 README 只保留项目概览、启动入口、常用操作和文档导航
- 当前细节按模块归属维护，每项约定只保留一处权威说明，其他位置使用链接
- 小修复未改变对外行为或开发约定时可不更新文档，不为每次改动追加日期小节或几百字过程记录

### 文档入口
- 项目概览与开发文档索引：[README.md](README.md)

# 多语言翻译
- 默认自动使用`baoyu-translate`技能的refined精翻模式进行翻译
- 根据场景使用自然、简洁的表达
