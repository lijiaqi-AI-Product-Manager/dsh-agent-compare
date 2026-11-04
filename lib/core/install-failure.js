import { diagnosticText } from './proc.js';
/** Classify observed installation output; never infer a lock mismatch from a frozen install alone. */
export function installFailure(result) {
    const output = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    const diagnostic = diagnosticText(output
        .replace(/\b(https?:\/\/)[^\s/?#@]+@/gi, '$1[redacted]@')
        .replace(/(authorization\s*[:=]\s*(?:Bearer|Basic)\s+)[^\s]+/gi, '$1[redacted]')
        .replace(/((?:_authToken|_auth|password|token)\s*[:=]\s*)[^\s"'&]+/gi, '$1[redacted]')
        .replace(/\b(?:npm_[a-zA-Z0-9]{20,}|gh[pousr]_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,})\b/g, '[redacted]'), 1200);
    const fact = (kind, summary, hint, code) => ({ kind, summary, hint, ...(code ? { code } : {}), ...(diagnostic ? { diagnostic } : {}) });
    if (result.aborted)
        return fact('cancelled', '依赖安装已停止', '已写出的候选仍保留；需要时可重新验收，不必重新生成。');
    if (result.timedOut)
        return fact('timeout', '依赖安装超过时间上限', '检查 registry、网络和安装脚本；解决后可保留候选重新验收。');
    const auth = /\b(?:E401|E403|ENEEDAUTH|EOTP|ERR_PNPM_FETCH_40[13]|YN0041|YN0033)\b/.exec(output)?.[0];
    if (auth)
        return fact('authentication', '包服务拒绝访问', '检查 registry 登录状态、私有包权限和访问策略。不要把凭据填进需求或比较记录。', auth);
    const network = /\b(?:ECONNRESET|ECONNREFUSED|ECONNABORTED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|ENETUNREACH|EHOSTUNREACH|ERR_SOCKET_TIMEOUT|CERT_HAS_EXPIRED|UNABLE_TO_VERIFY_LEAF_SIGNATURE|SELF_SIGNED_CERT_IN_CHAIN|DEPTH_ZERO_SELF_SIGNED_CERT|ERR_TLS_CERT_ALTNAME_INVALID|UNABLE_TO_GET_ISSUER_CERT_LOCALLY)\b/.exec(output)?.[0];
    if (network || /socket hang up|fetch failed|getaddrinfo/i.test(output))
        return fact('network', '包服务连接或证书检查失败', '检查网络、registry、代理和证书；连接恢复后可重新验收原候选。无需因此修改锁文件。', network);
    const runtime = /\b(?:EBADENGINE|EBADPLATFORM|ERR_PNPM_UNSUPPORTED_ENGINE)\b/.exec(output)?.[0];
    if (runtime)
        return fact('runtime', '依赖要求的运行环境不满足', '检查依赖要求的 Node.js、包管理器和操作系统版本；环境满足后再验收原候选。', runtime);
    const filesystem = /\b(?:EACCES|EPERM|EROFS|EBUSY|ENOSPC|EDQUOT|EMFILE|ENFILE|ENOENT)\b/.exec(output)?.[0];
    if (filesystem)
        return fact('filesystem', '安装时的文件或磁盘操作失败', /ENOSPC|EDQUOT/.test(filesystem) ? '释放磁盘空间或检查配额后重新验收原候选。' : '检查候选目录权限、被占用的文件和可用文件句柄，再重新验收原候选。', filesystem);
    const lock = /\b(?:ERR_PNPM_OUTDATED_LOCKFILE|ERR_PNPM_FROZEN_LOCKFILE_WITH_OUTDATED_LOCKFILE|ERR_PNPM_LOCKFILE_CONFIG_MISMATCH|ERR_PNPM_NO_LOCKFILE|ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY|YN0028)\b/.exec(output)?.[0];
    if (lock || /(?:package\.json|package-lock\.json|npm-shrinkwrap\.json)[\s\S]{0,300}(?:in sync|out of sync)|(?:Missing: .+ from lock file|Invalid: lock file's)/i.test(output))
        return fact('lockfile', '锁文件与依赖定义不一致', '先让依赖声明与锁文件保持一致，再开始新的比较；当前封存版本不会被重写，也不会改用非冻结安装。', lock);
    return fact('unknown', '依赖安装失败，原因尚未确定', '展开安装日志查看具体错误。修正环境后可重新验收原候选；不能把这次失败直接归因于锁文件。');
}
