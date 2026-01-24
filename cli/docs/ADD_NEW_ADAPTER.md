# 如何添加新 Adapter

重构后，添加新adapter只需 **3步**！

## 示例：添加 Windsurf Adapter

### Step 1: 创建 Adapter 文件

创建文件：`cli/src/adapters/windsurf.ts`

```typescript
import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import type { Skill, MCPServer, Agent, Command } from "@src/types/models.js";
import { atomicWrite } from "@src/utils/atomic-write.js";
import {
  hashSkill,
  hashMCPServer,
  hashAgent,
  hashCommand,
} from "@src/utils/hash.js";
import type {
  AdapterConfig,
  ToolAdapter,
  ValidationResult,
  WriteResult,
} from "./base.js";

/**
 * Windsurf adapter
 * Reads/writes to .windsurf directory
 */
export class WindsurfAdapter implements ToolAdapter {
  readonly config: AdapterConfig;

  // ✨ 元数据字段（自注册系统）
  readonly toolName = "windsurf";
  readonly displayName = "Windsurf";
  readonly configFormat = "json" as const;
  readonly envVarFormat = "claude" as const;
  readonly capabilities = {
    skills: true,
    mcp: true,
    agents: true,
    commands: true,
  } as const;
  readonly isReadOnly = false;

  constructor(config: AdapterConfig) {
    this.config = config;
  }

  // 实现 ToolAdapter 接口的所有方法...
  async readSkills(): Promise<Skill[]> {
    // 实现读取逻辑
  }

  async writeSkills(skills: Skill[]): Promise<WriteResult> {
    // 实现写入逻辑
  }

  // ... 其他方法
}
```

### Step 2: 注册到 Registry

编辑：`cli/src/adapters/registry.ts`

```typescript
import { WindsurfAdapter } from "./windsurf.js";  // 添加导入

export const ADAPTERS = [
  ClaudeCodeAdapter,
  CursorAdapter,
  OpenCodeAdapter,
  CodexAdapter,
  WindsurfAdapter,  // ✅ 添加这一行！
] as const;
```

**就这样！** 类型系统自动更新：
- `ToolName` 自动包含 `"windsurf"`
- 所有命令自动支持 windsurf
- 所有工具函数自动识别 windsurf

### Step 3: 创建测试文件

创建文件：`cli/test/adapters/windsurf.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import mockFs from "mock-fs";
import { WindsurfAdapter } from "@src/adapters/windsurf.js";

describe("WindsurfAdapter", () => {
  let adapter: WindsurfAdapter;

  beforeEach(() => {
    adapter = new WindsurfAdapter({
      tool: "windsurf",
      baseDir: "/test"
    });

    mockFs({
      "/test/.windsurf": {},
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  it("should have correct metadata", () => {
    expect(adapter.toolName).toBe("windsurf");
    expect(adapter.displayName).toBe("Windsurf");
    expect(adapter.configFormat).toBe("json");
    expect(adapter.envVarFormat).toBe("claude");
    expect(adapter.isReadOnly).toBe(false);
  });

  // 添加更多测试...
});
```

## 完成！🎉

运行测试验证：

```bash
cd cli
pnpm test                  # 所有测试应该通过
pnpm typecheck             # 类型检查
pnpm lint                  # 代码规范
```

现在你的新adapter已经：
- ✅ 被类型系统识别
- ✅ 可以在所有命令中使用
- ✅ 自动出现在工具列表中
- ✅ 支持所有registry helper函数

## 对比：重构前 vs 重构后

### 重构前（20+ 文件）❌
```
1. 创建 adapters/windsurf.ts
2. 修改 adapters/registry.ts（添加switch case）
3. 修改 types/config.ts（添加到ToolName联合类型）
4. 修改 utils/env-vars.ts（如果需要新格式）
5. 修改 commands/import.ts（添加实例化逻辑）
6. 修改 commands/init.ts（添加实例化逻辑）
7. 修改 commands/sync.ts（添加实例化逻辑）
8. 修改 core/config-manager.ts
9. 创建 test/adapters/windsurf.test.ts
10-23. 更新 13+ 个测试文件
```

### 重构后（3 文件）✅
```
1. 创建 adapters/windsurf.ts（带元数据）
2. 修改 adapters/registry.ts（添加1行到ADAPTERS数组）
3. 创建 test/adapters/windsurf.test.ts
```

**工作量减少 85%！** 🚀

---

最后更新：2026-01-25
