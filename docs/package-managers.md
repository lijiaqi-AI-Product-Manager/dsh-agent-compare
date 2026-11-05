# 包管理器与网络 / Package managers and networking

识别锁文件不等于整套工具链已经通过交付验收。以下原生检查使用 DSH 0.2.1-rc.5、Node 26.13.0、React 19.3.1、Vite 8.3.5 和 TypeScript 7.0.2；候选修改由测试脚本提供，不请求外部模型。Windows 为本机实测，Linux 由独立 `package manager runtime` CI 输出各项实际结果。

| 包管理器 | Windows 结果 | 验证范围 |
|---|---|---|
| npm 12.2.1 | 完整流程通过 | 冻结安装、类型检查、构建、双预览、共同页面验收、采用后检查及撤销 |
| pnpm 12.16.1 | 生成前阻止 | 原生安装报存储锁权限错误；版本检查阻止两份候选请求模型，不更换版本、不放宽边界 |
| Yarn Classic 1.22.22 | 完整流程通过 | `--frozen-lockfile` 和同一套交付检查 |
| Yarn 4.18.1 · `node-modules` | 完整流程通过 | `--immutable` 和同一套交付检查 |
| Yarn 4.18.1 · PnP | 不能声明完整支持 | 示例基线及两份候选的类型检查报 `TS2688`；安装、构建和页面检查通过也不能写入工作区 |

Recognizing a lockfile is separate from verified delivery. The native test uses controlled edits, not an external model. The Windows rows distinguish complete flows, a pre-generation environment rejection, and a PnP baseline type-check limitation. CI prints the actual Linux results separately. A successful build or page check never overrides a failed shared type check.

## 选择与版本

- 优先使用 `package.json#packageManager` 的准确版本声明，再使用对应锁文件。多个锁文件且没有明确声明时，先提示处理，不猜测管理器。
- 开始生成前，在各自副本内确认声明的版本与实际命令一致。共用工具链检查失败时，两版都不请求模型；重新验收时也重新核对版本。
- Windows/Desktop 的 PATH 中没有 pnpm 时，可使用宿主公开的 `profileContext.packageManager` 入口。只复用命令、参数及必要的 Node 运行开关，不复制其中的凭据环境。不会用内置 pnpm 悄悄替换项目要求的另一版本。
- Node 25 及以上不再内置 Corepack。插件不会自动安装或启用全局包管理器；请在 DSH 所用环境中准备项目声明的管理器。

Exact project declarations take precedence. Ambiguous lockfiles, missing commands and version mismatches are actionable environment errors. Bundled pnpm is a host-provided invocation, not permission to substitute versions. Modern Node does not bundle Corepack.

## 已知限制

pnpm 12.16.1 在 Windows 上通过系统 API 将用户存储锁放在 LocalAppData；`storeDir`、`PNPM_HOME` 或临时目录设置不能迁移这组锁。当前 DSH 沙箱没有为该额外目录提供声明接口，因此本插件保守阻止 Windows pnpm 12+ 生成。Linux 执行是独立验证项，不能用 Linux 成功推断 Windows 可用。依据：[pnpm 锁目录实现](https://github.com/pnpm/pnpm/blob/main/pnpm/crates/fs/src/secure_temp_lock.rs)、[存储说明](https://github.com/pnpm/pnpm/blob/main/pnpm/docs/settings/store.md)。

Yarn PnP 的加载器与依赖位置由管理器重建，不作为应用修改采用。候选封存使用可信源树建立私有 Git 索引，防止自行暂存的依赖或加载器绕过排除规则。验收前移除副本内固定的 PnP 运行文件，再按锁文件重建；项目原有加载器保留。现代 Yarn 的预览通过项目命令启动并记录启动方式，重启后的进程归属检查同时核对项目和端口。

这不修补 TypeScript 7 本身的 PnP 解析。当前示例基线的 `tsc --noEmit` 也报告缺少 `vite/client` 类型，因此该组合保留为明确失败案例，不切换旧编译器、不跳过类型检查、不宣称全流程通过。[Yarn PnP 说明](https://yarnpkg.com/features/pnp)、[TypeScript 适配说明](https://yarnpkg.com/getting-started/qa)。

## 代理、镜像与凭据

沿用宿主的 `scrubbedParentEnv()`；常规代理和 registry 设置不被插件恢复成未经清理的全量环境。包含密钥、密码或 Token 名称的变量仍由宿主过滤。私有包认证需要遵守宿主权限与凭据规则，不要把凭据写进需求、比较记录或公开配置。

- npm、pnpm 与 Yarn Classic 使用自己的 registry / 项目 `.npmrc` 规则。
- Yarn 现代版使用 `.yarnrc.yml` 的 `npmRegistryServer`、`httpProxy`、`httpsProxy` 及 `networkSettings`，不能把 npm 的配置方式或 `NO_PROXY` 语义直接套用给它。参见 [Yarn 官方配置](https://yarnpkg.com/configuration/yarnrc)。
- 所有候选保留独立可变缓存和安装状态，不共享 `node_modules`。不关闭 TLS 检查、不更改项目的生命周期脚本许可、不用非冻结重试掩盖锁文件错误。

网络检查启动仅限回环地址的 registry 与代理，使用实际包管理器验证项目 registry、代理路由及适用管理器的 `NO_PROXY`；还核对宿主清理后的环境与敏感变量缺失。HTTP 放行只存在于临时 Yarn 测试配置的两个明确主机，不影响用户配置。它不证明任何外部代理、镜像或私有包服务可用。

Each candidate retains independent mutable caches. The local transport fixtures exercise real manager requests, without disabling production TLS checks or enabling dependency scripts. Yarn Modern's own network configuration is tested; `NO_PROXY` compatibility is not invented for it.

## 复现

```bash
npm install --prefix .runtime-checks/host-sdk --ignore-scripts --no-audit --no-fund @deepseek-ai/dsh@0.2.1-rc.5
npm run test:managers
```

脚本在忽略的 `.runtime-checks/` 中准备固定版本管理器和真实项目。它只在测试用 pnpm 工具目录中允许该准确版本的启动安装钩子，不修改全局设置或用户项目的脚本策略。每项输出自己的结果；负面案例明确输出 `supported: false`，不能当作正向功能通过。
