# dsh-skills-manager

供 DeepSeek Harness Desktop 和 Web 使用的纯 DSH 插件，包名为 `dsh-skills-manager`。安装后从 **设置 → 技能** 打开，使用原生设置控件和主题颜色。

仓库：[laoqiu/dsh-skills-manager](https://github.com/laoqiu/dsh-skills-manager)。导航图标由 DSH 设置外壳提供，部分宿主可能显示通用设置图标。

## 功能

- 设置页标题旁显示插件版本，下方显示简介；右侧图标依次提供检查更新、GitHub 和问题反馈，统一右对齐且悬停提示显示在下方；页面出现滚动条时保持位置一致。检查更新对比本仓库最新的 `vX.Y.Z` 正式 GitHub Release，并提供发布说明入口；尚未发布或查询失败时明确提示，检查本身不安装插件。技能列表在进入页面和窗口重新获得焦点时刷新。
- 搜索技能名称与简介。
- 搜索框右侧提供工作区筛选，默认显示所有工作区。各工作区按名称分组，最后显示「全局」，每组均可展开与收起；选中一个工作区时保留该工作区和全局技能。
- 列表显示名称和单行简介，右侧并列提供删除、编辑图标及启停开关；文件路径可悬停名称查看。
- 编辑完整 `SKILL.md`，保留技能目录中的脚本和资源；无效元数据也可以打开修复。
- 「让 Agent 帮我创建或安装技能」打开会话并填入草稿，由用户检查后发送。
- 跟随 DSH 的中英文语言和浅色 / 深色主题。

## 安装

适配 **DSH 0.2.1-rc.2**，DSH 依赖版本精确固定。需要 Node.js `^22.19.0 || >=24`。当前未发布到 npm，可直接从 GitHub 安装。

Desktop 打开「插件 → 添加插件」，输入：

```text
https://github.com/laoqiu/dsh-skills-manager/archive/refs/heads/main.tar.gz
```

Web 使用已安装的 DSH CLI：

```powershell
dsh plugin --profile web add https://github.com/laoqiu/dsh-skills-manager/archive/refs/heads/main.tar.gz
```

安装后重启对应应用，在「设置 → 技能」中管理技能。Web 与 Desktop 的 profile 独立。仓库包含已构建的 `lib/` 入口，归档安装无需在本机编译 TypeScript；运行依赖仍由 DSH 包管理器安装。更新时重新安装该 GitHub 地址，再重启应用。`main` 跟随最新提交，需要固定版本时使用具体提交的 GitHub 归档地址。

### 从源码开发

```powershell
git clone https://github.com/laoqiu/dsh-skills-manager.git
cd dsh-skills-manager
npm ci
npm run build
npm test
npm pack
```

`lib/` 是随源码提交的生成产物，修改 `src/` 后需重新构建并一并提交。`npm pack` 会自动构建，生成 `dsh-skills-manager-0.1.2.tgz`，包含 Host、Client 入口与 Cordis 补丁。开发时也可在 Desktop 安装已构建目录，或通过 `dsh plugin --profile web add <本地绝对路径>` 安装。

### 从旧包名更新

0.1.2 的包名为 `dsh-skills-manager`。旧版以 `@deepseek-ai/dsh-skills-manager` 安装的 profile，需要移除旧依赖并添加新包 `dsh-skills-manager-0.1.2.tgz` 或本仓库的 GitHub 归档地址；仅重启不能更新旧依赖名。配置条目 ID 保持 `dsh-skills-manager`，兼容已有启停设置。

## 技能来源

| 范围 | 目录 | 列表来源标识 |
| --- | --- | --- |
| 全局 | `$DSH_HOME/skills`，默认 `~/.dsh/skills` | `user-dsh` |
| 全局 | `$DSH_AGENTS_HOME/skills`，默认 `~/.agents/skills` | `user-agents` |
| 全局 | 插件配置中的 `customSkillDirs` | `custom` |
| 全局 | 环境变量 `DSH_BUNDLED_SKILL_DIR` 指定的目录 | `bundled`，只读 |
| 项目 | 已注册工作区所属 Git 根目录的 `.dsh/skills` | `project-dsh` |
| 项目 | 已注册工作区所属 Git 根目录的 `.agents/skills` | `project-agents` |

没有 Git 根目录时，使用工作区本身作为项目根。支持 `<技能目录>/SKILL.md` 和技能根目录下的单个 `.md` 文件；`user-dsh` 中的 `.system` 不在管理范围。表中的来源标识用于文件分类，列表不显示来源文字。无需打开工作区会话即可查看已注册工作区的技能；同一项目根目录的技能可以显示在多个工作区分组中，修改的是同一份文件。

列表展示物理文件，包括已停用、元数据无效以及同名的多份技能；它不是当前 Agent 最终解析后的去重技能目录。其他 provider 提供的虚拟技能不在管理范围。链接技能和内置目录只读。

### 自定义目录

默认配置沿用 DSH 的 home 环境变量。若原有 `skill-filesystem` 使用了目录覆盖，需要给本插件设置相同值。示例 overlay：

```yaml
- id: dsh-skills-manager
  config:
    dshHome: 'E:/dsh-data'
    agentsHome: 'E:/agents-data'
    customSkillDirs:
      - 'E:/shared-skills'
    maxFileBytes: 1048576
```

`dshHome`、`agentsHome` 是 home 目录，插件会在其下查找 `skills/`；`customSkillDirs` 直接指向技能根目录。`maxFileBytes` 是单个指令文件的 UTF-8 字节上限，默认 1 MiB，最小 1024 字节。

配置管理页的自定义目录，只会让文件出现在此列表；还需在 DSH 的 `skill-filesystem` 中配置对应目录，Agent 才会加载它们。读取失败或超限时，列表显示不完整提示。

## 编辑、停用与删除

编辑器保存完整 YAML 元数据和 Markdown 正文，检查名称、简介与调用控制字段。修改 `name` 不会重命名资源目录。保存前检查文件版本；若文件已被外部修改，会保留编辑草稿并提示重新打开对照。

停用会在 `SKILL.md` 中设置：

```yaml
disable-model-invocation: true
user-invocable: false
```

原有调用控制保存在 `x-dsh-skills-manager-invocation` 元数据中；重新启用时恢复原值。因此原本「仅手动调用」的技能，启用后仍保持这一限制。对于原先已完全停用且没有恢复记录的技能，启用会恢复模型与手动两种调用。

删除需要确认，会永久移除该技能目录及资源；单文件技能只删除对应文件。目录内的符号链接或 junction 只解除链接，不递归删除其目标。部分删除失败会明确提示检查剩余文件，不宣称操作已全部完成。

默认 DSH 文件监视器会重载技能变更。若关闭了 `skill-filesystem.watch`，需重启 DSH。DSH 0.2.1-rc.2 的已打开会话可能缓存 `/` 技能建议，刷新页面可更新该列表；技能管理页可直接点击「刷新」。

「自定义」沿用 DSH 原生新会话流程，可能复用尚未发送的空会话，并保留已有输入草稿。它不会自动发送消息、下载技能或执行安装脚本；筛选到具体工作区时，在该工作区打开会话并附带其路径，显示所有工作区时则由 DSH 沿用当前或最近工作区。草稿会询问技能应保存到全局还是项目目录。

## 代码结构

```text
src/
  index.ts      Host：配置、工作区目录和原生连接路由
  skills.ts     文件发现、元数据、编辑、启停和删除
  protocol.ts   请求和响应校验
  client.tsx    设置页、弹窗、提示和会话跳转
  locales.ts    中英文文案
  styles.ts     使用 DSH 主题变量的局部布局
tests/          文件操作、Host 和 Client 测试
lib/            构建产物
cordis.patch.yml
```

Host 和 Client 共用一个包与构建配置。通信复用 DSH 的认证连接，不另外启动 HTTP 服务。请求使用服务端生成的条目 ID，修改操作检查文件修订值并串行执行；文件替换使用同目录临时文件。修订检查用于发现过期编辑，不提供跨进程文件锁。

`tsconfig.json` 仅引用 Host 与 Client 项目，共享编译选项放在 `tsconfig.base.json`，两套项目分别由 `tsconfig.host.json` 和 `tsconfig.client.json` 检查。增量检查缓存保存在 `node_modules/.cache/skills-manager/`。

验证命令为 `npm run build` 和 `npm test`。测试涵盖调用策略恢复、嵌套 YAML、过期编辑、资源保留、物理删除、链接目标保护、只读目录、请求校验、并发修改及 Client 错误反馈。实际 Web 验证使用隔离的 profile 和测试技能，未修改用户技能。

功能参考：[dsh-skills-manager-plus](https://github.com/appthin/dsh-skills-manager-plus)。

## 许可

MIT，见 [LICENSE](LICENSE)。
