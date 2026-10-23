# 研究方法与原型的第三方说明

日期：2026-10-22。本文件记录本轮真实参考来源与改编，不能当作对未审材料的统一授权。

## PRD及决策组织方法

本轮 `05_V02_PRD.md` 的六段组织结构及 `06_DECISIONS.md` 的上下文/决策/后果/替代方式参考并改编自 [SuperElectron/prd-template](https://github.com/SuperElectron/prd-template/tree/8eeca0c61eed0e1fd22c65a7226562332a03bed7)。正文、需求、数据界限与产品判断为本轮新写。以下保留其MIT声明：

```text
MIT License

Copyright (c) 2026 Matthew McCann

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 用户情境和证据来源方法

`02_USER_RESEARCH.md` 参考并中文改编 Microsoft [hve-core product-discovery](https://github.com/microsoft/hve-core/blob/main/.github/skills/project-planning/requirements-author/references/prd/product-discovery.md) 的情境/旅程及证据来源方法，来源blob `3089f886a18830c619b36a969d0af8ec4a68d448`，作者Microsoft，许可[CC BY4.0](https://creativecommons.org/licenses/by/4.0/)。改动包括：中文改写、以本项目的待验证情境替换模板、按来源和适用性区分置信度。没有照搬其全套BRD/PRD工作流，也不暗示Microsoft认可本产品。

机会树、JTBD等框架按名称参考原作者的方法，不复制上游受版权保护的画布或书籍段落。论文和竞品链接用于评估，不表示背书或允许复制代码。

## 未复制到产品的代码

deanpeters库只评估，未复制其NC-SA模板。竞品代码和许可证仅在研究档案内，不能移入正式产品而忽略各自条款。NeuroFlow/Resettle的隔离运行使用其原始公开文件；JumpyBrain、Focus Lock与dh-focus只按[竞品矩阵](03_COMPETITORS_EVIDENCE.md)的许可证结论评估。本轮原型交互逻辑自行编写。

原型使用本项目已锁定的React等依赖，依赖许可证随包管理器安装文件提供；原型分发物的依赖声明见 `prototypes/detour/README.md`。发布或再分发时应保留实际打包依赖的许可证。没有改变现有项目的整体许可证。
