#!/bin/bash

# 接口测试脚本
# 用于验证 chain_crawler 的各个接口是否正常工作

echo "🔍 Chain Crawler 接口测试"
echo "========================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试函数
test_endpoint() {
    local url="$1"
    local name="$2"
    local expected="$3"
    
    echo -n "测试 $name ($url): "
    
    # 发送请求并检查响应
    response=$(curl -s -w "%{http_code}" "$url" 2>/dev/null)
    http_code="${response: -3}"
    content="${response%???}"
    
    if [ "$http_code" = "200" ]; then
        if [ -n "$expected" ] && [[ "$content" != *"$expected"* ]]; then
            echo -e "${RED}❌ 失败 (内容不匹配)${NC}"
            echo "   期望包含: $expected"
            echo "   实际响应: ${content:0:50}..."
        else
            echo -e "${GREEN}✅ 成功${NC}"
        fi
    else
        echo -e "${RED}❌ 失败 (HTTP $http_code)${NC}"
        if [ "$http_code" = "000" ]; then
            echo "   错误: 连接失败，请检查服务是否启动"
        fi
    fi
}

# 检查进程
echo "🔍 检查进程状态..."
if pgrep -f "chain_crawler" > /dev/null; then
    echo -e "${GREEN}✅ chain_crawler 进程正在运行${NC}"
else
    echo -e "${YELLOW}⚠️  chain_crawler 进程未运行，请先启动应用${NC}"
    echo "   启动命令: ./build/chain_crawler -h 0"
    echo ""
fi

# 检查端口
echo ""
echo "🔍 检查端口占用..."
for port in 8080 8081 9502; do
    if lsof -i :$port > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 端口 $port 已被占用${NC}"
    else
        echo -e "${RED}❌ 端口 $port 未被占用${NC}"
    fi
done

echo ""
echo "🧪 接口测试..."

# 测试各个接口
test_endpoint "http://localhost:8081/ping" "Ping接口" "pong"
test_endpoint "http://localhost:8081/metrics" "Metrics接口" "go_goroutines"
test_endpoint "http://localhost:9502/debug/pprof/" "Pprof接口" "<title>/debug/pprof/</title>"

# 测试主API接口（如果有的话）
echo ""
echo "🔍 测试主API接口..."
test_endpoint "http://localhost:8080/web3-chaincrawler/metrics" "主API Metrics" ""

echo ""
echo "📝 接口信息汇总:"
echo "   Ping接口:    http://localhost:8081/ping"
echo "   Metrics接口: http://localhost:8081/metrics"
echo "   Pprof接口:   http://localhost:9502/debug/pprof/"
echo "   主API:       http://localhost:8080/web3-chaincrawler/*"
echo ""
echo "💡 如果接口无法访问，请检查："
echo "   1. 应用程序是否已启动"
echo "   2. 端口是否正确 (8081端口用于metrics，8080端口用于主API)"
echo "   3. 防火墙设置"
echo "   4. 配置文件中的监听地址设置" 