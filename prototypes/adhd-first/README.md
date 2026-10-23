# BackToIt v0.2b ADHD-first 研究原型

与旧 `prototypes/detour` 并行保留的独立网页体验，不是正式扩展更新。所有任务都是演示样例，不读扩展数据库。无需诊断、账号或 API Key。

## 实现前的设计选择（2026-10-23）

主线是「已保存的下一步 → 一个可修改的小动作 → 自愿尝试」，趣味集中在能亲手放入三片、形成完整小岛的一次拼接。它是可预测的操作反馈，没有胜负、随机奖励或下一局。三次操作结束即返回，45/90/180 秒只是上限。

沿用 paper #f7fafc、mist #eaf1f7、ink #20364a、action #235ea7，拼接增加叶绿 #3b7165 和沙色 #edbe75。系统 Segoe UI / Microsoft YaHei、16px 正文。左对齐任务内容，拼接画面居中；宽屏把原任务放在右侧持续可见，窄屏先显示任务再显示当前一步。没有营销 Hero、远程字体或通用仪表盘。

```text
接着来                               语言
研究原型 · 演示样例
当前任务 / 已保存的下一步
[接着做]                  ← 唯一主动作
我卡住了                  ← 主动展开需要
先放这里
研究设置（折叠）

卡住后：开始不了 / 想刷点别的 / 真的累了
每次只进入一条路径；直接接着做、今天先到这里持续可用
```

复核：UI/UX 检索推荐的医疗风字体、绿橙品牌色及营销视频结构与现有产品不符，未采用；采用其单指替代拖动、键盘可达、焦点和 reduced motion 建议。拼接使用点击/Space/Enter即可完成，不把精细拖拽、速度或记忆当门槛。

## 启动与对照

从仓库根目录运行（Node 22.12+，根 pnpm 锁文件）：

```powershell
pnpm install --frozen-lockfile
node prototypes/adhd-first/scripts/tool.mjs dev
```

打开 http://127.0.0.1:4178/ 。旧对照原型仍用 `node prototypes/detour/scripts/tool.mjs dev`，端口4174。它们使用不同 localStorage key，互不改写。Ctrl+C 停止相应服务器。

```powershell
node prototypes/adhd-first/scripts/tool.mjs typecheck
node prototypes/adhd-first/scripts/tool.mjs test
node prototypes/adhd-first/scripts/tool.mjs build
pnpm browsers:install
node prototypes/adhd-first/scripts/tool.mjs browser-test
```

build 后也可 `node prototypes/adhd-first/scripts/serve-built.mjs` 只用 Node 启动预览。浏览器测试默认自行启动此预览，请先关闭占用4178的开发服务器。dist 不提交到 Git。

## Demo 脚本

1. 在恢复卡直接「接着做」；观察它只呈现样例下一步，不声称已真实动手。
2. 返回任务卡，「我卡住了 → 开始不了」：读原始下一步、修改本地建议，选择不计时的小步或自愿30秒辅助。
3. 「想刷点别的」：选择上限，用鼠标或键盘依次放入三片，立即自然结束；随时可直接返回。没有下一局。可以关闭趣味入口。
4. 「我真的累了」：选45/90/180秒，离开屏幕；重新打开按时间戳显示剩余或已结束。允许提前结束、一次显式安静延长、今天先到这里。
5. 「先放这里」：可空着跳过或暂存一句；无倒计时，不创建另一任务。
6. 展开研究设置，在另一窗口编辑/归档/删除/切换样例，验证原会话不会恢复错误任务；可制造无下一步和无任务状态。

## 能力和数据边界

本地规则只截取原下一步的第一个短句，过长时给出明确通用建议；不生成任务细节。原文始终保留，可改建议但不自动覆盖任务。UI语言切换保留用户写下的原文。

仅存 `backtoit:adhd-first-research:v1`，锁名 `backtoit-adhd-first-research`。只处理演示状态，当前会话、最多12条临时想法和界面偏好；不记录行为事件、诊断或分析数据。储存损坏保留原值直到用户明确重置；写入失败不声称成功。Web Locks 不可用时不降级为可能丢写的并发逻辑。

没有外部网络、模型、音频、通知、手机检测、B站播放感知或真实资料打开。按钮点击、拼接完成、30秒到期均不证明真实工作开始。适用性尚无真人验证。

正式文档与实际验收见 [ADHD-first 索引](../../docs/product/adhd-first/README.md) 和 [测试及技能报告](../../docs/product/adhd-first/07_TEST_AND_SKILLS_REPORT.md)。
