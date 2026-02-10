#!/usr/bin/env node

/**
 * 构建产物分析脚本
 * 用于分析打包后的文件大小和优化建议
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, 'dist/itdos.os/dist/static/js');
const KB = 1024;
const MB = KB * 1024;

function getFileSize(filePath) {
    const stats = fs.statSync(filePath);
    return stats.size;
}

function formatSize(bytes) {
    if (bytes >= MB) {
        return `${(bytes / MB).toFixed(2)} MB`;
    }
    return `${(bytes / KB).toFixed(2)} KB`;
}

function analyzeFiles() {
    console.log('\n📊 构建产物分析报告\n');
    console.log('━'.repeat(80));
    
    if (!fs.existsSync(distDir)) {
        console.log('❌ dist 目录不存在，请先运行构建命令');
        return;
    }
    
    const files = fs.readdirSync(distDir)
        .filter(file => file.endsWith('.js'))
        .map(file => {
            const filePath = path.join(distDir, file);
            const size = getFileSize(filePath);
            return { file, size, filePath };
        })
        .sort((a, b) => b.size - a.size);
    
    let totalSize = 0;
    const largeFiles = [];
    const vendorFiles = [];
    
    console.log('\n📦 文件大小排行 (前20):\n');
    files.slice(0, 20).forEach((item, index) => {
        const sizeStr = formatSize(item.size);
        const indicator = item.size > 1 * MB ? '⚠️ ' : 
                         item.size > 500 * KB ? '⚡ ' : '✓ ';
        
        console.log(`${(index + 1).toString().padStart(2)}. ${indicator} ${item.file.padEnd(50)} ${sizeStr.padStart(12)}`);
        
        totalSize += item.size;
        
        if (item.size > 1 * MB) {
            largeFiles.push(item);
        }
        
        if (item.file.startsWith('vendor-')) {
            vendorFiles.push(item);
        }
    });
    
    console.log('\n' + '━'.repeat(80));
    console.log(`\n📊 统计信息:\n`);
    console.log(`   总文件数: ${files.length}`);
    console.log(`   总大小: ${formatSize(totalSize)}`);
    console.log(`   超过1MB的文件: ${largeFiles.length} 个`);
    console.log(`   Vendor文件: ${vendorFiles.length} 个`);
    
    if (largeFiles.length > 0) {
        console.log('\n⚠️  需要优化的大文件:\n');
        largeFiles.forEach(item => {
            console.log(`   • ${item.file} - ${formatSize(item.size)}`);
            
            // 提供优化建议
            if (item.file.includes('vendor-monaco')) {
                console.log(`     建议: Monaco编辑器可以按需加载，不要在首屏引入`);
            } else if (item.file.includes('vendor-charts')) {
                console.log(`     建议: 图表库建议在报表页面才异步加载`);
            } else if (item.file.includes('vendor-three')) {
                console.log(`     建议: Three.js仅在3D功能时加载`);
            } else if (item.file.includes('vendor-libs')) {
                console.log(`     建议: 考虑进一步拆分该包，将不常用的库单独分离`);
            } else if (item.file.includes('vendor-office')) {
                console.log(`     建议: Office预览库建议在文档预览时才加载`);
            }
        });
    }
    
    console.log('\n✨ 优化建议:\n');
    console.log('   1. 将大型库(Monaco、Echarts、Three.js等)改为路由级按需加载');
    console.log('   2. 使用动态import()延迟加载非首屏组件');
    console.log('   3. 考虑使用CDN加载常用的大型库');
    console.log('   4. 启用Brotli或Gzip压缩');
    console.log('   5. 优化图片资源，使用WebP格式');
    
    console.log('\n' + '━'.repeat(80) + '\n');
}

analyzeFiles();
