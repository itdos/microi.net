# 素材库工作流

> 适用范围：用户提到“素材库”“登记素材”“上传素材”“保存到素材库”“先把图片/视频收进库里”。

## 何时读取

- 用户只想把资源放进素材库，不立即发布
- 用户要先上传，再登记成素材
- 用户要批量准备后续可复用素材
- 用户要把已有素材移动到另一个素材库分组

## 决策树

- 用户只说“上传素材并登记”：优先 `yxer material add --file ...`
- 用户已经有 upload 结果，只差登记素材：走 `yxer material create <payload.json>`
- 用户只是准备发布资源，不一定要入素材库：走普通 `yxer upload`

## 推荐流程

### 一体化素材登记

```bash
yxer material add --file .\demo.mp4 --type video
```

### 移动已有素材

```bash
yxer material move-by-name demo.png --group-id <group_id> --dry-run
yxer material move-by-name demo.png --group-id <group_id>

# 文件名重名时，先查询候选并使用真实素材 ID。
yxer material list --name demo.png --type image
yxer material move <material_id> --group-id <group_id> --dry-run
yxer material move <material_id> --group-id <group_id>
```

移动前可查询真实分组 ID：

```bash
yxer material groups --page 1 --size 50
```

### 分步素材登记

1. `yxer upload --file <path> --bucket material-library`
2. 读取 upload 返回的真实资源字段
3. 组装素材 payload
4. `yxer material create <payload.json>`

## 规则

- `material add` 优先于手工 `upload + material create`
- `material create` 前提是资源已经上传到 `material-library`
- `material move-by-name` 通过精确文件名匹配查询结果中的真实素材 ID；重名时不自动移动，必须由用户从候选 ID 中选择
- `material move` 只接受真实素材 ID 和目标分组 ID；先 dry-run 确认目标后再执行
- 素材任务不等同于发布任务；不需要 `prepare` / `schema fields` / `schema get`，除非用户随后要直接发布
- 若用户要“上传后马上发布”，完成素材任务后切回对应发布 workflow

## 严禁行为

- 未上传到素材库桶就执行 `material create`
- 把发布 payload 直接拿来当素材 payload
- 在素材任务里无意义地进入发布主流程
