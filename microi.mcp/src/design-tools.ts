import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MicroiClient, ApiResponse } from './microi-client.js';
import type { McpServerContext } from './server.js';
import {
  normalizePageJsonObj,
  normalizePrintObj,
  normalizePrintPageObj,
  pageDesignPayload,
  printDesignPayload,
} from './design-engine.js';

type ToolContent = { type: 'text'; text: string };
type ToolResult = { content: ToolContent[]; isError?: boolean };
type JsonRecord = Record<string, unknown>;

const jsonRecordSchema = z.record(z.unknown());

function textResult(text: string, isError = false): ToolResult {
  return { content: [{ type: 'text', text }], isError };
}

function apiText(title: string, response: ApiResponse, append?: JsonRecord): ToolResult {
  const payload = append ? { response: response.Data ?? {}, ...append } : response.Data ?? {};
  const lines = [
    `## ${title}`,
    `- Code: ${response.Code}`,
    response.Msg ? `- Message: ${response.Msg}` : '',
    '',
    '```json',
    JSON.stringify(payload, null, 2),
    '```',
  ].filter(Boolean);
  return textResult(lines.join('\n'), response.Code !== 1);
}

export function registerDesignTools(server: McpServer, client: MicroiClient, context: McpServerContext): void {
  const osClient = context.osClient;

  server.tool(
    'microi_validate_page_design',
    `Validate and normalize a Microi Page Engine JsonObj for OsClient ${osClient}. Accepts raw JsonObj, a mic_page row, {JsonObj}, {JsonStr}, or {formData:{JsonObj}} and returns the canonical JsonObj string saved to mic_page.JsonObj.`,
    { json: z.unknown().describe('Page Engine JSON in any common AI output shape.') },
    async ({ json }) => {
      const normalized = normalizePageJsonObj(json);
      return textResult(JSON.stringify(normalized, null, 2), !normalized.ok);
    },
  );

  server.tool(
    'microi_validate_print_design',
    `Validate and normalize a Microi Print Engine PageObj/PrintObj pair for OsClient ${osClient}. PageObj must contain hiprint panels and printElements.`,
    {
      pageObj: z.unknown().describe('Print Engine PageObj, or a wrapper containing PageObj/pageObj.'),
      printObj: z.unknown().optional().describe('Optional PrintObj sample/runtime data.'),
    },
    async ({ pageObj, printObj }) => {
      const page = normalizePrintPageObj(pageObj);
      const data = normalizePrintObj(printObj);
      const ok = page.ok && data.ok;
      return textResult(JSON.stringify({ ok, page, printObj: data }, null, 2), !ok);
    },
  );

  server.tool(
    'microi_build_page_design',
    `Build a good-looking Page Engine dashboard JsonObj from a natural language description. By default this is a dry run; to write mic_page pass save=true and confirmExecution equal to the title or "EXECUTE". OsClient ${osClient}.`,
    {
      prompt: z.string().describe('Natural language design request, such as "做一个维保工单运营驾驶舱，包含工单趋势、设备风险、待办列表".'),
      title: z.string().optional().describe('Page title. Auto-generated from prompt if omitted.'),
      number: z.string().optional().describe('Page Number/code. Auto-generated if omitted.'),
      desc: z.string().optional().describe('Page description.'),
      theme: z.string().optional().describe('Optional business theme: maintenance, mall, sales, finance, operations.'),
      style: z.string().optional().describe('Optional visual style, e.g. light, dark, 大屏, 简洁.'),
      routePath: z.string().optional().describe('Optional route path saved to mic_page.RoutePath.'),
      componentPath: z.string().optional().describe('Optional component path saved to mic_page.ComponentPath.'),
      save: z.boolean().optional().describe('Default false. When true, save to mic_page.'),
      confirmExecution: z.string().optional().describe('Required when save=true. Must equal the title or "EXECUTE".'),
    },
    async (input) => {
      const payload = pageDesignPayload(input);
      const normalized = normalizePageJsonObj(payload.jsonObj);
      if (!normalized.ok || !normalized.json) return textResult(JSON.stringify(normalized, null, 2), true);

      if (!input.save) {
        return textResult(JSON.stringify({
          ok: true,
          dryRun: true,
          title: payload.title,
          number: payload.number,
          desc: payload.desc,
          jsonStr: normalized.json,
          jsonObj: normalized.value,
          warnings: normalized.warnings,
          next: `Call this tool again with save=true and confirmExecution="${payload.title}" to write mic_page.`,
        }, null, 2));
      }

      if (input.confirmExecution !== payload.title && input.confirmExecution !== 'EXECUTE') {
        return textResult(`Write blocked. Pass confirmExecution="${payload.title}" or "EXECUTE".`, true);
      }

      const response = await client.savePageEngine({
        Title: payload.title,
        Number: payload.number,
        Desc: payload.desc,
        JsonStr: normalized.json,
        RoutePath: input.routePath,
        ComponentPath: input.componentPath,
      });
      return apiText('Build And Save Page Design', response, {
        title: payload.title,
        number: payload.number,
        warnings: normalized.warnings,
      });
    },
  );

  server.tool(
    'microi_build_print_template_design',
    `Build a good-looking Print Engine hiprint template from a natural language description. By default this is a dry run; to write mic_print pass save=true and confirmExecution equal to the title or "EXECUTE". OsClient ${osClient}.`,
    {
      prompt: z.string().describe('Natural language print template request, such as "做一张维保工单打印模板，含客户、设备、故障、处理明细、签字区".'),
      title: z.string().optional().describe('Template title. Auto-generated from prompt if omitted.'),
      number: z.string().optional().describe('Template Number/code. Auto-generated if omitted.'),
      desc: z.string().optional().describe('Template description.'),
      dataApi: z.string().optional().describe('Optional DataApi called by print renderer for runtime data.'),
      paperType: z.string().optional().describe('Paper type. Default A4.'),
      save: z.boolean().optional().describe('Default false. When true, save to mic_print.'),
      confirmExecution: z.string().optional().describe('Required when save=true. Must equal the title or "EXECUTE".'),
    },
    async (input) => {
      const payload = printDesignPayload(input);
      const page = normalizePrintPageObj(payload.pageObj);
      const data = normalizePrintObj(payload.printObj);
      if (!page.ok || !data.ok || !page.json || !data.json) {
        return textResult(JSON.stringify({ ok: false, page, printObj: data }, null, 2), true);
      }

      if (!input.save) {
        return textResult(JSON.stringify({
          ok: true,
          dryRun: true,
          title: payload.title,
          number: payload.number,
          desc: payload.desc,
          dataApi: payload.dataApi,
          pageObj: page.value,
          printObj: data.value,
          pageObjStr: page.json,
          printObjStr: data.json,
          warnings: [...page.warnings, ...data.warnings],
          next: `Call this tool again with save=true and confirmExecution="${payload.title}" to write mic_print.`,
        }, null, 2));
      }

      if (input.confirmExecution !== payload.title && input.confirmExecution !== 'EXECUTE') {
        return textResult(`Write blocked. Pass confirmExecution="${payload.title}" or "EXECUTE".`, true);
      }

      const response = await client.savePrintTemplate({
        Title: payload.title,
        Number: payload.number,
        Desc: payload.desc,
        DataApi: payload.dataApi,
        PageObj: page.json,
        PrintObj: data.json,
      });
      return apiText('Build And Save Print Template', response, {
        title: payload.title,
        number: payload.number,
        warnings: [...page.warnings, ...data.warnings],
      });
    },
  );

  server.tool(
    'microi_save_page_design',
    `Create or update mic_page with Page Engine JsonObj normalization. This is the write-safe version for AI generated JSON. Writes require confirmExecution equal to title or "EXECUTE". OsClient ${osClient}.`,
    {
      pageId: z.string().optional(),
      title: z.string(),
      number: z.string().optional(),
      desc: z.string().optional(),
      json: z.unknown().describe('Raw JsonObj, {JsonObj}, {JsonStr}, mic_page row, or {formData:{JsonObj}}.'),
      routePath: z.string().optional(),
      componentPath: z.string().optional(),
      confirmExecution: z.string().optional(),
    },
    async ({ pageId, title, number, desc, json, routePath, componentPath, confirmExecution }) => {
      if (confirmExecution !== title && confirmExecution !== 'EXECUTE') {
        return textResult(`Write blocked. Pass confirmExecution="${title}" or "EXECUTE".`, true);
      }
      const normalized = normalizePageJsonObj(json);
      if (!normalized.ok || !normalized.json) return textResult(JSON.stringify(normalized, null, 2), true);
      const response = await client.savePageEngine({
        PageId: pageId,
        Title: title,
        Number: number,
        Desc: desc,
        JsonStr: normalized.json,
        RoutePath: routePath,
        ComponentPath: componentPath,
      });
      return apiText('Save Page Design', response, { warnings: normalized.warnings });
    },
  );

  server.tool(
    'microi_save_print_template_design',
    `Create or update mic_print with Print Engine PageObj/PrintObj normalization. Writes require confirmExecution equal to title or "EXECUTE". OsClient ${osClient}.`,
    {
      template: jsonRecordSchema.describe('Template with Title/title, optional Id/Number/Desc/DataApi, PageObj/pageObj and PrintObj/printObj.'),
      confirmExecution: z.string().optional(),
    },
    async ({ template, confirmExecution }) => {
      const titleValue = typeof template.Title === 'string' ? template.Title : typeof template.title === 'string' ? template.title : '';
      if (!titleValue) return textResult('Template Title cannot be empty.', true);
      if (confirmExecution !== titleValue && confirmExecution !== 'EXECUTE') {
        return textResult(`Write blocked. Pass confirmExecution="${titleValue}" or "EXECUTE".`, true);
      }
      const page = normalizePrintPageObj(template.PageObj ?? template.pageObj);
      const data = normalizePrintObj(template.PrintObj ?? template.printObj);
      if (!page.ok || !data.ok || !page.json || !data.json) {
        return textResult(JSON.stringify({ ok: false, page, printObj: data }, null, 2), true);
      }
      const response = await client.savePrintTemplate({
        ...template,
        Title: titleValue,
        PageObj: page.json,
        PrintObj: data.json,
      });
      return apiText('Save Print Template Design', response, { warnings: [...page.warnings, ...data.warnings] });
    },
  );
}
