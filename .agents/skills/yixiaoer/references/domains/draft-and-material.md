# 草稿与素材库

适用范围：用户要保存草稿、登记素材、上传素材到素材库，或先存资源再继续发布。

**CRITICAL - 用户说“草稿”时，MUST 先区分蚁小二草稿、平台草稿、还是仅上传素材；禁止自行猜测。**

## 读取顺序

1. [`../protocols/execution.md`](../protocols/execution.md)
2. [`../protocols/confirmation.md`](../protocols/confirmation.md)
3. [`../protocols/provenance.md`](../protocols/provenance.md)
4. [`../protocols/error-recovery.md`](../protocols/error-recovery.md)
5. 草稿任务：[`../workflows/draft-workflow.md`](../workflows/draft-workflow.md)
6. 素材任务：[`../workflows/material-workflow.md`](../workflows/material-workflow.md)
7. 若随后要直接发布，再切回 [`./publish.md`](./publish.md)

## 常用命令

```bash
yxer draft save <payload.json> [--dry-run]
yxer draft import <article.docx> --cover <horizontal-cover.jpg> --account-id <online-account-id> [--author 蚁小二] [--original-author <original-author>] [--draft-id <existing-draft-id>] [--dry-run]
yxer material add --file <文件路径或URL> [--thumb <缩略图路径或URL>] [--type image|video|file] [--dry-run]
yxer upload --file <file_path> --bucket material-library
yxer upload --url <resource_url> --bucket material-library
yxer material create <payload.json> [--dry-run]
yxer material list [--name <file_name>] [--type image|video|file] [--page 1] [--size 100]
yxer material move <material_id> --group-id <group_id> [--dry-run]
yxer material move-by-name <file_name> --group-id <group_id> [--dry-run]
yxer material groups [--page 1] [--size 50]
```

## 决策规则

- 用户只说“保存草稿”时，先区分蚁小二草稿和平台草稿，不要自行猜测
- 用户只想把资源放进素材库时，优先 `material add`
- 用户已有上传结果，只差登记素材时，再用 `material create`
- 用户要移动素材库中的已有素材时，优先使用 `material move-by-name <文件名>`；它会通过真实查询结果匹配素材 ID。文件名重名时必须从候选 ID 中选择，再用 `material move`；先以 `--dry-run` 核对请求
- 草稿和素材写操作必须先 dry-run；资源字段必须保留上传来源，不能手写 key、尺寸或格式
- 微信公众号文章从 DOCX 导入时，使用 `yxer draft import`；正文内嵌图片会上传到素材库并改写为稳定 URL，封面必须传入宽度大于高度的横版图片
- 素材任务不自动进入发布主流程；只有用户明确要“上传后马上发布”时，再切回发布域
- 用户明确说“先存一下，别发”时，停在本域，不擅自回切发布域
