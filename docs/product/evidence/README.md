# 精选研究和验证证据

这些文件复制自 2026-10-22（America/Los_Angeles）的本地研究和工程验收，保留原始日期、结果和限制。副本仅去除个人路径、邮箱并调整文档链接；原始记录仍在本机 artifacts/product-discovery。不是新的测试运行。

- [v0.1 重新验证](baseline.json)：105 项测试、6 条扩展 E2E；[测试日志](baseline-logs/test.log)、[扩展日志](baseline-logs/test-e2e.log)。
- [工程隔离](isolation.json) 与 [保护指纹](v01-before-sha256.json)：79 个文件未变，独立重建的 15 个生产文件与原输出一致。
- [原型单元测试](prototype/unit-results.json)、[原型浏览器测试](prototype/browser-results.json)、[原型截图](prototype/screenshots)。
- [真实等待 45 秒的独立检查](independent-review/recon.json)。
- [研究来源](research/sources.json)、[五个仓库固定版本及审计](research/code-audit.json)、[竞品合成状态截图](research/screenshots)。
- [PRD 首轮](prd-review.md) 和 [修订后复核](prd-review-final.md)：22 项文档检查通过，不表示 Gate1 或 Gate2 通过。
- [技能来源记录](skills-reviewed.json)。

研究子目录 README 内的下载和运行步骤是历史工作区说明；此副本不包含上游源码、运行脚本或浏览器资料。按 code-audit.json 的固定版本链接可审阅来源。截图都是合成任务，无参与者或真实任务数据。

本目录按明确清单导入，忽略生成文件以防 Tailwind 自动扫描证据文本。副本文件的字节哈希会因脱敏变化；JSON 中保留的源码指纹仍指向原审计对象。研究参与者人数为 0；工程通过不能推导产品疗效。
