import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimePanelHeight, runtimeSurfaceStyle, pageChartTheme } from '../src/views/page-engine/engine/utils/runtimePresentation.js';
import { buildAiConnectionPrompt } from '../src/utils/ai-connection.js';

test('legacy design heights do not create empty runtime panels; fixed/minimum height remains explicit', () => {
  assert.equal(runtimePanelHeight({height:220},false,false),'auto');
  assert.equal(runtimePanelHeight({height:220},true,false),'220px');
  assert.equal(runtimePanelHeight({height:220,heightMode:'fixed'},false,false),'220px');
  assert.equal(runtimePanelHeight({height:220,heightMode:'fixed'},false,true),'auto');
});
test('dark rendering converts neutral surfaces and preserves business colour, images, opacity and saved styles', () => {
  const original={backgroundColor:'#ffffff',color:'#333',padding:'12px'};
  assert.deepEqual(runtimeSurfaceStyle(original,true),{backgroundColor:'var(--el-bg-color)',color:'var(--el-text-color-primary)',padding:'12px'});
  assert.equal(original.backgroundColor,'#ffffff');
  assert.equal(runtimeSurfaceStyle({color:'#1f2937'},true).color,'var(--el-text-color-primary)');
  for (const backgroundColor of ['#f3f4f6','#F5F7FA','rgb(243,244,246)']) assert.equal(runtimeSurfaceStyle({backgroundColor},true).backgroundColor,'var(--el-bg-color)');
  for(const backgroundColor of ['#16a34a','transparent','rgba(255,255,255,.1)','linear-gradient(red,blue)']) {
    assert.equal(runtimeSurfaceStyle({backgroundColor},true).backgroundColor,backgroundColor);
  }
  assert.equal(runtimeSurfaceStyle(original,false),original);
  assert.equal(runtimeSurfaceStyle(original,true,true),original);
});
test('chart theme updates labels and tooltip without changing data or explicit layout', () => {
  const option={title:{text:'Orders'},xAxis:{data:['Jan']},yAxis:[{type:'value'}],series:[{data:[12],itemStyle:{color:'#00a'}}],grid:{left:80}};
  const themed=pageChartTheme(option,true);
  assert.equal(themed.grid.left,80);assert.equal(themed.grid.containLabel,true);
  assert.equal(themed.yAxis[0].axisLabel.color,'#aab8cc');
  assert.equal(themed.series[0].data,option.series[0].data);
  assert.equal(themed.series[0].itemStyle.color,'#00a');
  assert.equal(option.title.textStyle,undefined);
});
test('connection paragraph uses stdin and contains connection context without requiring account password',()=>{
 const result=buildAiConnectionPrompt({ApiBase:'https://test.invalid',OsClient:'test',Token:'fixture'});
 assert.match(result,/auth import --session-stdin/);assert.match(result,/@microi.net\/cli/);
 assert.match(result,/ApiBase/);assert.match(result,/OsClient/);assert.doesNotMatch(result,/吾码|--token|--password/);
});
