import type { RenderContext } from '../../types.js';
import { dim } from '../colors.js';

export function renderEnvironmentLine(ctx: RenderContext): string | null {
  const display = ctx.config?.display;

  if (display?.showConfigCounts === false) {
    return null;
  }

  const totalCounts = ctx.claudeMdCount + ctx.rulesCount + ctx.mcpCount + ctx.hooksCount;
  const threshold = display?.environmentThreshold ?? 0;

  if (totalCounts === 0 || totalCounts < threshold) {
    return null;
  }

  const verbose = display?.showConfigFiles ?? false;
  const parts: string[] = [];

  if (ctx.claudeMdCount > 0) {
    if (verbose) {
      parts.push(ctx.claudeMdFiles.join(', '));
    } else {
      parts.push(`${ctx.claudeMdCount} CLAUDE.md`);
    }
  }

  if (ctx.rulesCount > 0) {
    if (verbose) {
      const ruleNames = ctx.rulesFiles.map(f => f.replace(/^.*\//, '').replace(/\.md$/, ''));
      parts.push(`rules: ${ruleNames.join(', ')}`);
    } else {
      parts.push(`${ctx.rulesCount} rules`);
    }
  }

  if (ctx.mcpCount > 0) {
    if (verbose) {
      parts.push(`MCPs: ${ctx.mcpServers.join(', ')}`);
    } else {
      parts.push(`${ctx.mcpCount} MCPs`);
    }
  }

  if (ctx.hooksCount > 0) {
    if (verbose) {
      parts.push(`hooks: ${ctx.hooks.join(', ')}`);
    } else {
      parts.push(`${ctx.hooksCount} hooks`);
    }
  }

  if (parts.length === 0) {
    return null;
  }

  return dim(parts.join(' | '));
}
